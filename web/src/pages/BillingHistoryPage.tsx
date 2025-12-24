import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Ghost } from 'lucide-react';
import { BillingRow, BillingRowData } from '../components/billing/BillingRow';
import { BillingHistoryModal } from '../components/billing/BillingHistoryModal';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { get, post } from '../api';

interface StripeBillingItem {
  id: string;
  type: 'charge' | 'refund' | 'invoice' | 'failed';
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  invoiceNumber?: string;
  receiptNumber?: string;
  chargeId?: string;
  refundReason?: string;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
}

export default function BillingHistoryPage() {
  const [selectedRow, setSelectedRow] = useState<BillingRowData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<BillingRowData | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingRowData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch billing history from API
  useEffect(() => {
    const fetchBillingHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await get<{ items: StripeBillingItem[] }>('/billing/invoices');
        
        // Map Stripe items to BillingRowData format
        const mappedItems: BillingRowData[] = response.items.map((item) => {
          // Format date for display
          const date = new Date(item.date);
          const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          // Determine type and status
          let type: BillingRowData['type'] = item.type;
          let status: 'OPEN' | 'OVERDUE' | undefined = undefined;

          if (item.type === 'invoice') {
            if (item.status === 'open') {
              status = 'OPEN';
            } else if (item.status === 'uncollectible' || item.status === 'void') {
              status = 'OVERDUE';
            }
          } else if (item.type === 'charge' && item.status === 'paid') {
            type = 'charge';
          } else if (item.type === 'refund') {
            type = 'refund';
          } else if (item.status === 'failed' || item.status === 'uncollectible') {
            type = 'failed';
          }

          return {
            id: item.id,
            type,
            date: formattedDate,
            description: item.description,
            amount: item.amount,
            status,
            invoiceNumber: item.invoiceNumber,
            receiptNumber: item.receiptNumber,
            refundReason: item.refundReason,
            hostedInvoiceUrl: item.hostedInvoiceUrl,
            invoicePdf: item.invoicePdf,
          };
        });

        setBillingHistory(mappedItems);
      } catch (err: any) {
        console.error('[BILLING] Error fetching billing history:', err);
        // If Stripe is not configured, show empty state gracefully
        if (err.status === 503) {
          setError(err.body?.message || 'Stripe not configured');
        } else {
          setError(err.message || 'Failed to load billing history');
        }
        setBillingHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBillingHistory();
  }, []);

  const handleRowAction = async (row: BillingRowData) => {
    if (row.type === 'failed') {
      // Show confirmation for retry payment
      setPendingAction(row);
      setIsConfirmDialogOpen(true);
    } else if (row.type === 'charge' || row.type === 'invoice') {
      // For charges/invoices, check if we have a PDF URL
      if (row.invoicePdf || row.hostedInvoiceUrl) {
        const pdfUrl = row.invoicePdf || row.hostedInvoiceUrl;
        if (pdfUrl) {
          window.open(pdfUrl, '_blank');
          return;
        }
      }
      // Otherwise open modal
      setSelectedRow(row);
      setIsModalOpen(true);
    } else {
      // Open modal directly for other actions
      setSelectedRow(row);
      setIsModalOpen(true);
    }
  };

  const handleConfirmRetry = async () => {
    if (!pendingAction) return;

    try {
      setIsConfirmDialogOpen(false);
      // Call retry endpoint
      await post(`/billing/retry/${pendingAction.id}`, {});
      
      // Refresh billing history
      const response = await get<{ items: StripeBillingItem[] }>('/billing/invoices');
      const mappedItems: BillingRowData[] = response.items.map((item) => {
        const date = new Date(item.date);
        const formattedDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        let type: BillingRowData['type'] = item.type;
        let status: 'OPEN' | 'OVERDUE' | undefined = undefined;

        if (item.type === 'invoice') {
          if (item.status === 'open') {
            status = 'OPEN';
          } else if (item.status === 'uncollectible' || item.status === 'void') {
            status = 'OVERDUE';
          }
        } else if (item.type === 'charge' && item.status === 'paid') {
          type = 'charge';
        } else if (item.type === 'refund') {
          type = 'refund';
        } else if (item.status === 'failed' || item.status === 'uncollectible') {
          type = 'failed';
        }

        return {
          id: item.id,
          type,
          date: formattedDate,
          description: item.description,
          amount: item.amount,
          status,
          invoiceNumber: item.invoiceNumber,
          receiptNumber: item.receiptNumber,
          refundReason: item.refundReason,
          hostedInvoiceUrl: item.hostedInvoiceUrl,
          invoicePdf: item.invoicePdf,
        };
      });

      setBillingHistory(mappedItems);
      setPendingAction(null);
    } catch (err: any) {
      console.error('[BILLING] Error retrying payment:', err);
      alert(err.message || 'Failed to retry payment');
    }
  };

  const handleDownload = () => {
    if (!selectedRow) return;

    // If frontend already has PDF URLs from API
    if (selectedRow.invoicePdf || selectedRow.hostedInvoiceUrl) {
      const url = selectedRow.invoicePdf || selectedRow.hostedInvoiceUrl;
      if (url) {
        window.open(url, '_blank');
        setIsModalOpen(false);
        return;
      }
    }

    // Otherwise show modal or gracefully exit
    console.log('[Billing] No PDF URL available');
    setIsModalOpen(false);
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto px-6 py-10">
      {/* Back to Billing */}
      <Link
        to="/settings/billing"
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-[#ff0a45] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Billing
      </Link>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2 hover:text-[#ff0a45] transition-colors shadow-[0_0_10px_rgba(255,10,69,0.3)]">
          Billing History
        </h1>
        <p className="text-sm text-neutral-400">
          View receipts, invoices, refunds, and payment activity.
        </p>
      </div>

      {/* Billing Disabled Mode Banner */}
      {error === "Stripe not configured" && (
        <div className="mb-6 p-4 rounded-xl border border-[#ff0a45]/30 bg-[#ff0a45]/10 shadow-[0_0_10px_rgba(255,10,69,0.3)]">
          <h3 className="text-white font-medium text-sm">
            Billing Disabled — Beta Program
          </h3>
          <p className="text-neutral-300 text-xs mt-1 leading-relaxed">
            Billing features are temporarily disabled during the closed beta.
            You won't be charged for anything while testing DealflowOS.
            Your feedback helps us improve the experience.
          </p>
        </div>
      )}

      {/* Billing History List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-neutral-400">Loading billing history...</div>
        </div>
      ) : error === "Stripe not configured" ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#ff0a45]/10 border border-[#ff0a45]/30 flex items-center justify-center mb-4">
            <Ghost className="w-8 h-8 text-[#ff0a45]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Billing Disabled for Beta Testers
          </h3>
          <p className="text-sm text-neutral-400 max-w-md">
            Since you're part of the DealflowOS closed beta, billing is turned off.
            Enjoy full access — your feedback helps shape the platform.
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
            <Ghost className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Unable to load billing history</h3>
          <p className="text-sm text-neutral-400 max-w-md">{error}</p>
        </div>
      ) : billingHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#ff0a45]/10 border border-[#ff0a45]/30 flex items-center justify-center mb-4">
            <Ghost className="w-8 h-8 text-[#ff0a45]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No billing activity yet.</h3>
          <p className="text-sm text-neutral-400 max-w-md">
            Charges, receipts, refunds, and invoices will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {billingHistory.map((row) => (
            <BillingRow key={row.id} row={row} onAction={handleRowAction} />
          ))}
        </div>
      )}

      {/* Billing History Modal */}
      <BillingHistoryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRow(null);
        }}
        row={selectedRow}
        onDownload={handleDownload}
      />

      {/* Confirmation Dialog for Retry Payment */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => {
          setIsConfirmDialogOpen(false);
          setPendingAction(null);
        }}
        onConfirm={handleConfirmRetry}
        title="Retry Payment"
        message="This will attempt to charge your card again. Continue?"
        confirmText="Continue"
        cancelText="Cancel"
      />
    </div>
  );
}
