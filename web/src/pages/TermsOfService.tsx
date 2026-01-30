import React from "react";
import { Link } from "react-router-dom";

export default function TermsOfService() {
  return (
    <div className="min-h-screen w-full text-[#F5F7FA] font-sans bg-gradient-to-b from-[#12141A] to-[#0B0D10]">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="text-[16px] font-semibold text-[#F5F7FA] hover:text-white/80 transition-colors">
          DealflowOS
        </Link>
      </header>

      {/* CONTENT */}
      <section className="min-h-[80vh] flex items-center justify-center px-6 sm:px-8 py-20">
        <div className="max-w-3xl w-full">
          <h1 className="text-3xl md:text-4xl font-semibold mb-2" style={{ color: '#F5F7FA' }}>
            Terms of Service
          </h1>
          <p className="text-sm mb-12" style={{ color: '#7C828A' }}>
            Last updated: January 2026
          </p>

          <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#A8AFB8' }}>
            <div>
              <p className="mb-4">
                <strong style={{ color: '#F5F7FA' }}>DealflowOS – Terms of Service</strong>
              </p>
              <p className="mb-4">
                These Terms of Service ("Terms") govern your access to and use of DealflowOS (the "Service"), operated by DealflowOS, Inc., a Delaware corporation ("Company," "we," "us," or "our").
              </p>
              <p>
                By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>1. Company Information</h2>
              <p>
                DealflowOS, Inc. is a Delaware C-Corporation. The Company may operate as a foreign corporation in one or more U.S. states where required by law.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>2. Description of the Service</h2>
              <p className="mb-2">
                DealflowOS is a software-as-a-service (SaaS) platform designed to help users organize and manage real estate wholesaling workflows, including leads, deals, follow-ups, documents, and basic analytics.
              </p>
              <p>
                The Service is provided for organizational and informational purposes only.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>3. No Professional Advice Disclaimer</h2>
              <p className="mb-2">
                DealflowOS does not provide legal, financial, tax, real estate brokerage, or investment advice.
              </p>
              <p>
                Any information provided through the Service is not a substitute for advice from qualified professionals. You are solely responsible for your real estate decisions, compliance with laws, and transaction outcomes.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>4. User Responsibility & Compliance</h2>
              <p>
                You are solely responsible for ensuring your use of the Service complies with all applicable laws. DealflowOS does not verify property ownership, deal legality, seller intent, or transaction validity.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>5. No Guarantees or Warranties</h2>
              <p>
                The Service is provided "as is" and "as available." We make no guarantees regarding deal success, profitability, lead quality, data accuracy, or availability.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>6. Limitation of Liability</h2>
              <p className="mb-2">
                To the maximum extent permitted by law, DealflowOS, Inc. shall not be liable for indirect, incidental, consequential, or punitive damages, including lost profits, lost deals, or business interruption.
              </p>
              <p>
                Our total liability shall not exceed the amount paid by you in the prior 12 months or $100, whichever is greater.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>7. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless DealflowOS, Inc. from any claims arising from your use of the Service, real estate activities, or violation of laws or third-party rights.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>8. Account Access & Security</h2>
              <p>
                You are responsible for maintaining the security of your account credentials. We are not liable for unauthorized access resulting from your failure to secure your account.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>9. Data & Privacy</h2>
              <p>
                Use of the Service is also governed by our Privacy Policy. We do not sell user data.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>10. Termination</h2>
              <p>
                You may stop using the Service at any time. We may suspend or terminate access for violations, abuse, or legal reasons.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>11. Modifications</h2>
              <p>
                We may update the Service or these Terms at any time. Continued use constitutes acceptance.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>12. Governing Law</h2>
              <p>
                These Terms are governed by the laws of the State of Delaware.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>13. Refund Policy</h2>
              <p className="mb-2">
                DealflowOS is a subscription software service. Payments are generally non-refundable, except in the limited situations listed below, or where refunds are required by applicable law.
              </p>
              <p className="mb-2">
                <strong style={{ color: '#F5F7FA' }}>Free Trial (Bronze).</strong> If you start a Bronze free trial, you'll have access during the trial period shown at signup. When the trial ends, continued access requires an active paid subscription.
              </p>
              <p className="mb-2">
                <strong style={{ color: '#F5F7FA' }}>Billing and Auto-Renewal.</strong> Subscriptions renew automatically unless you cancel before your renewal date. If your subscription renews, you authorize us (through our payment processor) to charge the payment method on file for the next billing period. You can view your plan, renewal date, and invoices in your account billing settings (or the customer billing portal, if enabled).
              </p>
              <p className="mb-2">
                <strong style={{ color: '#F5F7FA' }}>Cancellation.</strong> You can cancel at any time. If you cancel, you keep access through the end of your current paid period, and your subscription will not renew after that period ends. If you signed up online, you can cancel online through your billing settings/portal.
              </p>
              <p className="mb-2">
                <strong style={{ color: '#F5F7FA' }}>Renewal Reminder Notices (for certain longer-term renewals).</strong> For any plan that renews for a period longer than one month and would keep your subscription active beyond 12 months from when you first started, we will send an advance renewal reminder 30–60 days before the cancellation deadline for that renewal.
              </p>
              <p className="mb-2">
                <strong style={{ color: '#F5F7FA' }}>Refund Eligibility (Limited Exceptions).</strong> We may issue refunds only in these situations:
              </p>
              <p className="mb-2 ml-4">
                (A) <strong style={{ color: '#F5F7FA' }}>Billing Errors:</strong> If you were charged incorrectly due to a billing error (for example, a duplicate charge or an incorrect amount), we will refund the erroneous charge once verified.
              </p>
              <p className="mb-2 ml-4">
                (B) <strong style={{ color: '#F5F7FA' }}>Paid but No Access:</strong> If you were charged successfully but could not access DealflowOS due to a verified system issue on our side, we will either refund the affected charge or provide an account credit/extension of service, at our discretion.
              </p>
              <p className="mb-2 ml-4">
                (C) <strong style={{ color: '#F5F7FA' }}>Cancellation Failure:</strong> If you can show you attempted to cancel before renewal and were still charged due to a verified issue in our cancellation flow, we will refund the most recent renewal charge (or provide a credit), once verified.
              </p>
              <p className="mb-2 ml-4">
                (D) <strong style={{ color: '#F5F7FA' }}>Goodwill Window for Accidental Renewals:</strong> To prevent unnecessary disputes, we may provide a one-time courtesy refund if you contact us within 48 hours of the renewal charge, usage after the renewal is minimal, and a courtesy refund has not already been used for the same account within the last 12 months. This courtesy refund is discretionary and intended for genuine accidental renewals.
              </p>
              <p className="mb-2">
                <strong style={{ color: '#F5F7FA' }}>Non-Refundable Situations.</strong> Refunds are not provided for partial periods of service (including unused time) after the 48-hour goodwill window has passed; dissatisfaction with results or business outcomes; charges older than 48 hours (unless they qualify as a verified billing error, verified access failure, or verified cancellation failure); or violations of our Terms of Service or Acceptable Use Policy.
              </p>
              <p className="mb-2">
                <strong style={{ color: '#F5F7FA' }}>Disputes and Chargebacks.</strong> If you have a billing issue, please contact us first so we can help resolve it. If a chargeback is filed, we may suspend access to the account while we investigate.
              </p>
              <p className="mb-2">
                <strong style={{ color: '#F5F7FA' }}>How to Request a Refund.</strong> Contact support through the in-app support channel or the support contact listed on our website. Please include your account email, invoice date/amount, reason for request, and any relevant screenshots or details.
              </p>
              <p>
                <strong style={{ color: '#F5F7FA' }}>If We Miss a Required Renewal Notice (Where Applicable).</strong> If a renewal that requires advance notice was processed without the required notice, we will work with you to cancel that renewal and provide any refund/credit required by applicable law.
              </p>
            </div>

            <div>
              <h2 className="text-base font-semibold mb-3" style={{ color: '#F5F7FA' }}>14. Contact</h2>
              <p>
                Questions: <a href="mailto:questions@dealflowos.com" className="hover:text-white/80 transition-colors" style={{ color: '#A8AFB8' }}>questions@dealflowos.com</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}



