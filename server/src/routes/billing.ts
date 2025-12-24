import express from "express";
import { getStripeClient, isStripeConfigured } from "../billing/stripeClient.js";

export const billingRouter = express.Router();

// POST /billing/create-checkout-session
billingRouter.post("/create-checkout-session", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      items: [],
      message: "Stripe not configured"
    });
  }

  try {
    const stripe = getStripeClient();
    const priceId = process.env.STRIPE_DEFAULT_PRICE_ID;
    const customerId = process.env.STRIPE_DEFAULT_CUSTOMER_ID;

    if (!priceId) {
      return res.status(500).json({
        error: "STRIPE_DEFAULT_PRICE_ID is not configured",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/settings/billing-history?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/settings`,
    });

    res.json({
      url: session.url,
      id: session.id,
    });
  } catch (error: any) {
    console.error("[BILLING] Error creating checkout session:", error);
    res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message,
    });
  }
});

// POST /billing/portal
billingRouter.post("/portal", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      items: [],
      message: "Stripe not configured"
    });
  }

  try {
    const stripe = getStripeClient();
    const customerId = process.env.STRIPE_DEFAULT_CUSTOMER_ID;

    if (!customerId) {
      return res.status(500).json({
        error: "STRIPE_DEFAULT_CUSTOMER_ID is not configured",
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/settings/billing-history`,
    });

    res.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error("[BILLING] Error creating portal session:", error);
    res.status(500).json({
      error: "Failed to create portal session",
      message: error.message,
    });
  }
});

// GET /billing/invoices
billingRouter.get("/invoices", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      items: [],
      message: "Stripe not configured"
    });
  }

  try {
    const stripe = getStripeClient();
    const customerId = process.env.STRIPE_DEFAULT_CUSTOMER_ID;

    if (!customerId) {
      return res.status(500).json({
        error: "STRIPE_DEFAULT_CUSTOMER_ID is not configured",
      });
    }

    // Fetch invoices
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 20,
    });

    // Fetch charges
    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 20,
    });

    // Map invoices to simplified format
    const invoiceItems = invoices.data.map((inv) => {
      const amount = inv.amount_paid > 0 ? inv.amount_paid : inv.amount_due;
      const status = inv.status || "open";
      
      // Determine type based on status
      let type: "charge" | "invoice" | "refund" | "failed" = "invoice";
      if (status === "paid") {
        type = "charge";
      } else if (status === "uncollectible" || status === "void") {
        type = "failed";
      }
      
      return {
        id: inv.id,
        type,
        date: new Date(inv.created * 1000).toISOString(),
        amount: amount / 100, // Convert from cents to dollars
        currency: inv.currency || "usd",
        status: status,
        description: inv.description || inv.lines.data[0]?.description || "Invoice",
        invoiceNumber: inv.number || undefined,
        receiptNumber: inv.receipt_number || undefined,
        chargeId: inv.charge as string | undefined,
        refundReason: undefined,
        hostedInvoiceUrl: inv.hosted_invoice_url || undefined,
        invoicePdf: inv.invoice_pdf || undefined,
      };
    });

    // Fetch refunds for this customer's charges
    const refunds = await stripe.refunds.list({
      limit: 20,
    });

    // Map charges to simplified format
    // Only include charges that aren't already represented by invoices
    const invoiceChargeIds = new Set(invoiceItems.map((inv) => inv.chargeId).filter(Boolean));
    
    // Get charge IDs that have refunds
    const refundChargeIds = new Set(
      refunds.data
        .map((ref) => {
          const chargeId = typeof ref.charge === 'string' ? ref.charge : ref.charge?.id;
          return chargeId;
        })
        .filter(Boolean) as string[]
    );
    
    const chargeItems = charges.data
      .filter((ch) => ch.status === "succeeded" && !invoiceChargeIds.has(ch.id) && !refundChargeIds.has(ch.id))
      .map((ch) => {
        return {
          id: ch.id,
          type: "charge" as const,
          date: new Date(ch.created * 1000).toISOString(),
          amount: ch.amount / 100,
          currency: ch.currency || "usd",
          status: "paid",
          description: ch.description || "Payment",
          invoiceNumber: undefined,
          receiptNumber: ch.receipt_number || undefined,
          chargeId: ch.id,
          refundReason: undefined,
          hostedInvoiceUrl: undefined,
          invoicePdf: undefined,
        };
      });

    // Map refunds to simplified format
    // Only include refunds for charges that belong to our customer
    const refundItems = refunds.data
      .filter((ref) => {
        const chargeId = typeof ref.charge === 'string' ? ref.charge : ref.charge?.id;
        if (!chargeId) return false;
        const charge = charges.data.find((ch) => ch.id === chargeId);
        return charge && (charge.customer === customerId || (typeof charge.customer === 'object' && charge.customer?.id === customerId));
      })
      .map((ref) => {
        const chargeId = typeof ref.charge === 'string' ? ref.charge : ref.charge?.id;
        return {
          id: ref.id,
          type: "refund" as const,
          date: new Date(ref.created * 1000).toISOString(),
          amount: ref.amount / 100,
          currency: ref.currency || "usd",
          status: "refunded",
          description: ref.description || ref.reason || "Refund",
          invoiceNumber: undefined,
          receiptNumber: undefined,
          chargeId: chargeId || undefined,
          refundReason: ref.reason || "Customer request",
          hostedInvoiceUrl: undefined,
          invoicePdf: undefined,
        };
      });

    // Combine and sort by date (newest first)
    const allItems = [...invoiceItems, ...chargeItems, ...refundItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.json({
      items: allItems,
    });
  } catch (error: any) {
    console.error("[BILLING] Error fetching invoices:", error);
    res.status(500).json({
      error: "Failed to fetch invoices",
      message: error.message,
    });
  }
});

// POST /billing/retry/:invoiceId
billingRouter.post("/retry/:invoiceId", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      items: [],
      message: "Stripe not configured"
    });
  }

  try {
    const stripe = getStripeClient();
    const { invoiceId } = req.params;

    // Fetch invoice to check status
    const invoice = await stripe.invoices.retrieve(invoiceId);

    if (invoice.status !== "open" && invoice.status !== "uncollectible") {
      return res.status(400).json({
        error: "Invoice cannot be retried",
        message: `Invoice status is ${invoice.status}. Only 'open' or 'uncollectible' invoices can be retried.`,
      });
    }

    // Attempt to pay the invoice
    const paidInvoice = await stripe.invoices.pay(invoiceId);

    console.log("[BILLING] Invoice retry successful:", {
      invoiceId,
      status: paidInvoice.status,
    });

    res.json({
      success: true,
      invoiceId: paidInvoice.id,
      status: paidInvoice.status,
    });
  } catch (error: any) {
    console.error("[BILLING] Error retrying invoice:", error);
    res.status(500).json({
      error: "Failed to retry invoice",
      message: error.message,
    });
  }
});

// GET /billing/invoice/:id/pdf
billingRouter.get("/invoice/:id/pdf", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      items: [],
      message: "Stripe not configured"
    });
  }

  try {
    const stripe = getStripeClient();
    const { id } = req.params;

    const invoice = await stripe.invoices.retrieve(id);

    const pdfUrl = invoice.invoice_pdf || invoice.hosted_invoice_url;

    if (!pdfUrl) {
      return res.status(404).json({
        error: "PDF not available",
      });
    }

    res.json({
      url: pdfUrl,
    });
  } catch (error: any) {
    console.error("[BILLING] Error fetching invoice PDF:", error);
    res.status(500).json({
      error: "Failed to fetch invoice PDF",
      message: error.message,
    });
  }
});

