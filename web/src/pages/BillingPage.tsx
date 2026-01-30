import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api';
import { BillingRow } from '../components/billing/BillingRow';
import { BillingHistoryModal } from '../components/billing/BillingHistoryModal';
import { BillingCancelModal } from '../components/billing/BillingCancelModal';
import type { BillingRowData } from '../components/billing/BillingRow';

// API functions
async function getBillingSummary() {
  return get<unknown>('/api/billing/summary');
}

async function postBillingCancel() {
  return post<unknown>('/api/billing/cancel', {});
}

async function postBillingResume() {
  return post<unknown>('/api/billing/resume', {});
}

async function postBillingCancelFeedback(payload: { reasonCodes: string[]; otherText: string }) {
  return post<unknown>('/api/billing/cancel-feedback', payload);
}

async function postBillingPortal() {
  return post<{ url: string }>('/api/billing/portal', {});
}

// Normalized billing summary type
interface NormalizedBillingSummary {
  ok: boolean;
  plan: {
    status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none';
    priceId: string | null;
    subscriptionId: string | null;
    customerId: string | null;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    trialEnd: string | null;
  };
}

// Normalization function
function normalizeBillingSummary(input: unknown): NormalizedBillingSummary | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const obj = input as Record<string, unknown>;
  if (!obj.plan || typeof obj.plan !== 'object') {
    return null;
  }

  const plan = obj.plan as Record<string, unknown>;
  const allowedStatuses = ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'none'];
  const status = typeof plan.status === 'string' && allowedStatuses.includes(plan.status)
    ? plan.status as NormalizedBillingSummary['plan']['status']
    : 'none';

  return {
    ok: typeof obj.ok === 'boolean' ? obj.ok : false,
    plan: {
      status,
      priceId: typeof plan.priceId === 'string' ? plan.priceId : null,
      subscriptionId: typeof plan.subscriptionId === 'string' ? plan.subscriptionId : null,
      customerId: typeof plan.customerId === 'string' ? plan.customerId : null,
      cancelAtPeriodEnd: typeof plan.cancelAtPeriodEnd === 'boolean' ? plan.cancelAtPeriodEnd : false,
      currentPeriodEnd: typeof plan.currentPeriodEnd === 'string' ? plan.currentPeriodEnd : null,
      trialEnd: typeof plan.trialEnd === 'string' ? plan.trialEnd : null,
    },
  };
}

export default function BillingPage() {
  const queryClient = useQueryClient();

  // React Query for billing summary
  const { data: summaryData, isLoading: isLoadingSummary, isError: isSummaryError } = useQuery({
    queryKey: ['billing-summary'],
    queryFn: getBillingSummary,
  });

  const normalizedSummary = summaryData ? normalizeBillingSummary(summaryData) : null;
  const plan = normalizedSummary?.plan;

  // State for BillingHistoryModal
  const [selectedRow, setSelectedRow] = useState<BillingRowData | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // State for BillingCancelModal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const paymentMethod = {
    brand: 'visa' as 'visa' | 'mastercard',
    last4: '4242',
    expMonth: 12,
    expYear: 2025,
  };

  const accountInfo = {
    name: 'John Doe',
    email: 'john.doe@example.com',
  };

  const billingHistory: BillingRowData[] = [
    {
      id: '1',
      type: 'charge',
      date: 'Mar 15, 2024',
      description: 'Pro Plan Subscription',
      amount: 99.0,
      receiptNumber: 'RCP-001234',
      invoicePdf: 'https://example.com/receipts/rcp-001234.pdf',
    },
    {
      id: '2',
      type: 'invoice',
      date: 'Apr 15, 2024',
      description: 'Pro Plan Subscription',
      amount: 99.0,
      status: 'OPEN',
      invoiceNumber: 'INV-005678',
      hostedInvoiceUrl: 'https://example.com/invoices/inv-005678',
    },
    {
      id: '3',
      type: 'refund',
      date: 'Feb 10, 2024',
      description: 'Refund for Pro Plan',
      amount: 99.0,
      receiptNumber: 'REF-000789',
      refundReason: 'Customer request',
    },
    {
      id: '4',
      type: 'failed',
      date: 'Jan 20, 2024',
      description: 'Failed Payment - Pro Plan',
      amount: 99.0,
    },
  ];

  // Handlers
  const handleRowAction = (row: BillingRowData) => {
    setSelectedRow(row);
    setIsHistoryModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedRow(null);
  };

  const handleDownload = () => {
    if (selectedRow) {
      const url = selectedRow.invoicePdf || selectedRow.hostedInvoiceUrl;
      if (url) {
        window.open(url, '_blank');
      }
    }
  };

  // Cancel modal handlers
  const handleConfirmCancel = async (payload: { reasonCodes: string[]; otherText: string }) => {
    try {
      // Step 1: Cancel subscription (real action)
      await postBillingCancel();
      
      // Step 2: Invalidate query to refresh UI
      queryClient.invalidateQueries({ queryKey: ['billing-summary'] });
      
      // Step 3: Close modal
      setIsCancelModalOpen(false);
      
      // Step 4: Submit feedback best-effort (does not block cancel)
      try {
        await postBillingCancelFeedback(payload);
      } catch (feedbackError) {
        // Feedback failure is non-blocking; only log in dev
        if (import.meta.env.DEV) {
          console.warn('Failed to submit cancel feedback:', feedbackError);
        }
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      // Re-throw to let modal handle error display
      throw error;
    }
  };

  const handleResume = async () => {
    try {
      await postBillingResume();
      queryClient.invalidateQueries({ queryKey: ['billing-summary'] });
      setIsCancelModalOpen(false);
    } catch (error) {
      console.error('Failed to resume subscription:', error);
    }
  };

  const handleUpdateCard = async () => {
    try {
      const resp = await postBillingPortal();
      const url = (resp as any)?.url;
      if (typeof url === 'string' && url.length > 0) {
        window.location.assign(url);
        return;
      }
      console.error('Stripe portal response missing URL');
    } catch (err) {
      console.error('Failed to open Stripe portal', err);
    }
  };

  const handlePause30Days = () => {
    setIsCancelModalOpen(false);
  };

  const handleCloseCancelModal = () => {
    setIsCancelModalOpen(false);
  };

  const handleOpenCancelModal = () => {
    setIsCancelModalOpen(true);
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Glass card styling constants
  const cardBase = "relative rounded-2xl backdrop-blur-xl p-6 transition-all";
  const cardClass = "bg-white/70 border border-transparent shadow-[inset_0_0_0_1px_rgba(2,6,23,0.10),_0_18px_50px_rgba(2,6,23,0.10)] hover:shadow-[inset_0_0_0_1px_rgba(255,10,69,0.20),_0_18px_50px_rgba(2,6,23,0.10)] hover:z-10 dark:bg-[#0a0a0c]/60 dark:shadow-[inset_0_0_0_1px_rgba(255,10,69,0.14),_0_0_28px_rgba(255,10,69,0.14)] dark:hover:shadow-[inset_0_0_0_1px_rgba(255,10,69,0.26),_0_0_28px_rgba(255,10,69,0.14)]";

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-300';
      case 'trialing':
        return 'bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-300';
      case 'past_due':
        return 'bg-yellow-500/10 border border-yellow-500/25 text-yellow-600 dark:text-yellow-300';
      case 'canceled':
        return 'bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-300';
      case 'incomplete':
        return 'bg-orange-500/10 border border-orange-500/25 text-orange-600 dark:text-orange-300';
      case 'none':
        return 'bg-neutral-500/10 border border-neutral-500/25 text-neutral-600 dark:text-neutral-300';
      default:
        return 'bg-neutral-500/10 border border-neutral-500/25 text-neutral-600 dark:text-neutral-300';
    }
  };

  // Get status display text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'trialing':
        return 'Trialing';
      case 'past_due':
        return 'Past Due';
      case 'canceled':
        return 'Canceled';
      case 'incomplete':
        return 'Incomplete';
      case 'none':
        return 'No active subscription';
      default:
        return 'Unknown';
    }
  };

  // Format expiration date
  const formatExpDate = (month: number, year: number) => {
    return `${String(month).padStart(2, '0')}/${year.toString().slice(-2)}`;
  };

  // Determine if onDownload should be passed
  const shouldShowDownload = selectedRow && (selectedRow.type === 'charge' || selectedRow.type === 'invoice') && (selectedRow.invoicePdf || selectedRow.hostedInvoiceUrl);

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-10">
      {/* Back to Settings */}
      <Link
        to="/settings"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-neutral-400 hover:text-[#ff0a45] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
          Billing
        </h1>
        <p className="text-sm text-slate-600 dark:text-white/60">
          Manage your subscription, payment method, and invoices
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN - spans 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan Card */}
          <div className={`${cardBase} ${cardClass}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {plan?.status === 'none' ? 'No Plan' : 'Pro Plan'}
                </h2>
                {isLoadingSummary ? (
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium border bg-neutral-500/10 border-neutral-500/25 text-neutral-600 dark:text-neutral-300">
                    Loading...
                  </span>
                ) : isSummaryError || !normalizedSummary ? (
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium border bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-300">
                    Error
                  </span>
                ) : (
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(plan.status)}`}
                  >
                    {getStatusText(plan.status)}
                    {plan.cancelAtPeriodEnd && plan.currentPeriodEnd && ` (ends ${formatDate(plan.currentPeriodEnd)})`}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {isLoadingSummary ? (
                <div className="text-sm text-slate-600 dark:text-white/60">—</div>
              ) : isSummaryError || !normalizedSummary ? (
                <div className="text-sm text-red-600 dark:text-red-400">Failed to load billing information</div>
              ) : plan.status === 'none' ? (
                <div className="text-sm text-slate-600 dark:text-white/60">No active subscription</div>
              ) : (
                <>
                  {plan.trialEnd && plan.status === 'trialing' ? (
                    <div className="text-sm text-slate-600 dark:text-white/60">
                      Trial ends {formatDate(plan.trialEnd)}
                    </div>
                  ) : plan.cancelAtPeriodEnd && plan.currentPeriodEnd ? (
                    <div className="text-sm text-slate-600 dark:text-white/60">
                      Ends {formatDate(plan.currentPeriodEnd)}
                    </div>
                  ) : plan.currentPeriodEnd ? (
                    <div className="text-sm text-slate-600 dark:text-white/60">
                      Renews {formatDate(plan.currentPeriodEnd)}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600 dark:text-white/60">—</div>
                  )}
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">
                    $99.00 / month
                  </div>
                </>
              )}
            </div>

            {plan?.status === 'none' ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-[#080712]/30 text-slate-400 dark:text-white/30 cursor-not-allowed text-sm font-medium"
                >
                  Manage Plan
                </button>
                <button
                  type="button"
                  disabled
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-[#080712]/30 text-slate-400 dark:text-white/30 cursor-not-allowed text-sm font-medium"
                >
                  Cancel Plan
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleUpdateCard}
                  className="flex-1 px-4 py-2 rounded-lg border border-[#ff0a45]/25 bg-[#ff0a45]/8 text-[#ff0a45] hover:bg-[#ff0a45]/12 transition-all text-sm font-medium dark:bg-[#ff0a45]/10 dark:text-[#ff4d73] dark:hover:bg-[#ff0a45]/15"
                >
                  Manage Plan
                </button>
                {plan?.cancelAtPeriodEnd ? (
                  <button
                    type="button"
                    onClick={handleOpenCancelModal}
                    className="flex-1 px-4 py-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/14 transition-all text-sm font-medium dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
                  >
                    Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenCancelModal}
                    className="flex-1 px-4 py-2 rounded-lg border border-red-500/25 bg-red-500/10 text-red-600 hover:bg-red-500/14 transition-all text-sm font-medium dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/15"
                  >
                    Cancel Plan
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Billing History Card */}
          <div className={`${cardBase} ${cardClass}`}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Billing History
            </h2>

            {billingHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-white/45">
                <p className="text-sm">No billing activity yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {billingHistory.map((row) => (
                  <BillingRow key={row.id} row={row} onAction={handleRowAction} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - single column */}
        <div className="space-y-6">
          {/* Payment Method Card */}
          <div className={`${cardBase} ${cardClass}`}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Card on file
            </h2>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-600 dark:text-white/60" />
                <span className="text-sm text-slate-900 dark:text-white font-medium capitalize">
                  {paymentMethod.brand}
                </span>
                <span className="text-sm text-slate-600 dark:text-white/60">
                  •••• {paymentMethod.last4}
                </span>
              </div>
              <div className="text-sm text-slate-600 dark:text-white/60">
                Expires {formatExpDate(paymentMethod.expMonth, paymentMethod.expYear)}
              </div>
            </div>

            <button
              type="button"
              onClick={handleUpdateCard}
              className="w-full px-4 py-2 rounded-lg border border-[#ff0a45]/25 bg-[#ff0a45]/8 text-[#ff0a45] hover:bg-[#ff0a45]/12 transition-all text-sm font-medium dark:bg-[#ff0a45]/10 dark:text-[#ff4d73] dark:hover:bg-[#ff0a45]/15"
            >
              Update Card
            </button>

            <p className="text-xs text-slate-500 dark:text-white/45 mt-3">
              Changes apply to next renewal
            </p>
          </div>

          {/* Account Card */}
          <div className={`${cardBase} ${cardClass}`}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Account
            </h2>

            <div className="space-y-2 mb-4">
              <div className="text-sm text-slate-900 dark:text-white font-medium">
                {accountInfo.name}
              </div>
              <div className="text-sm text-slate-600 dark:text-white/60">
                {accountInfo.email}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-white/45">
              Receipts are emailed here
            </p>
          </div>
        </div>
      </div>

      {/* BillingHistoryModal - always rendered */}
      <BillingHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={handleCloseModal}
        row={selectedRow}
        onDownload={shouldShowDownload ? handleDownload : undefined}
      />

      {/* BillingCancelModal - always rendered */}
      <BillingCancelModal
        isOpen={isCancelModalOpen}
        onClose={handleCloseCancelModal}
        onConfirmCancel={handleConfirmCancel}
        {...(plan?.cancelAtPeriodEnd ? { onResume: handleResume } : {})}
        onPause30Days={handlePause30Days}
        accessEndsAt={plan?.currentPeriodEnd || undefined}
      />
    </div>
  );
}
