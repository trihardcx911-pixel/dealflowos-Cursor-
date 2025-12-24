import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Calendar, ExternalLink } from 'lucide-react';
import { get, post } from '../api';

interface InvoiceItem {
  id: string;
  type: 'charge' | 'refund' | 'invoice' | 'failed';
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  invoiceNumber?: string;
}

interface Subscription {
  status: string;
  currentPeriodEnd?: string;
  plan?: string;
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isManaging, setIsManaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch invoices
        const invoicesResponse = await get<{ items: InvoiceItem[] }>('/billing/invoices');
        setInvoices(invoicesResponse.items || []);

        // Stub subscription data for now
        setSubscription({
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          plan: 'Pro',
        });
      } catch (err: any) {
        console.error('[BILLING] Error fetching data:', err);
        if (err.status === 503) {
          setError('Billing integration is not configured');
        } else {
          setError(err.message || 'Failed to load billing information');
        }
        setInvoices([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleManageBilling = async () => {
    try {
      setIsManaging(true);
      const response = await post<{ url: string }>('/billing/portal', {});
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (err: any) {
      console.error('[BILLING] Error opening portal:', err);
      alert(err.message || 'Failed to open billing portal');
      setIsManaging(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const getNextInvoice = () => {
    const upcomingInvoices = invoices.filter(
      (inv) => inv.type === 'invoice' && (inv.status === 'open' || inv.status === 'draft')
    );
    if (upcomingInvoices.length > 0) {
      return upcomingInvoices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    }
    return null;
  };

  const nextInvoice = getNextInvoice();

  return (
    <div className="w-full max-w-[1100px] mx-auto px-6 py-10">
      {/* Back to Settings */}
      <Link
        to="/settings"
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-[#ff0a45] transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </Link>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2 hover:text-[#ff0a45] transition-colors shadow-[0_0_10px_rgba(255,10,69,0.3)]">
          Billing
        </h1>
        <p className="text-sm text-neutral-400">
          Manage your subscription and payment methods.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-neutral-400">Loading billing information...</div>
        </div>
      ) : error ? (
        <div className="neon-glass glass-layer-light p-8 text-center">
          <div className="text-red-400 mb-2">Unable to load billing information</div>
          <p className="text-sm text-neutral-400">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subscription Status Card */}
          <div className="neon-glass glass-layer-light p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Subscription</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      subscription?.status === 'active'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}
                  >
                    {subscription?.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                  {subscription?.plan && (
                    <span className="text-sm text-neutral-400">{subscription.plan} Plan</span>
                  )}
                </div>
              </div>
              <button
                onClick={handleManageBilling}
                disabled={isManaging}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_10px_#ff0a45] hover:shadow-[0_0_15px_#ff0a45] transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isManaging ? (
                  'Opening...'
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Manage Billing
                  </>
                )}
              </button>
            </div>

            {subscription?.currentPeriodEnd && (
              <div className="flex items-center gap-2 text-sm text-neutral-400 mt-4">
                <Calendar className="w-4 h-4" />
                <span>
                  Current period ends {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
            )}
          </div>

          {/* Next Invoice Card */}
          {nextInvoice && (
            <div className="neon-glass glass-layer-light p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Upcoming Invoice</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{nextInvoice.description}</p>
                  <p className="text-sm text-neutral-400 mt-1">
                    Due {formatDate(nextInvoice.date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-white">
                    {formatCurrency(nextInvoice.amount, nextInvoice.currency)}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {nextInvoice.invoiceNumber ? `Invoice #${nextInvoice.invoiceNumber}` : 'Pending'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Invoices */}
          <div className="neon-glass glass-layer-light p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Recent Invoices</h2>
              <Link
                to="/settings/billing-history"
                className="text-sm text-[#ff0a45] hover:text-[#ff0a45]/80 transition-colors"
              >
                View All
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div className="text-center py-8 text-neutral-400">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No invoices yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.slice(0, 5).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white text-sm font-medium">{invoice.description}</p>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            invoice.type === 'charge'
                              ? 'bg-green-500/20 text-green-400'
                              : invoice.type === 'refund'
                              ? 'bg-blue-500/20 text-blue-400'
                              : invoice.type === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {invoice.type}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {formatDate(invoice.date)}
                        {invoice.invoiceNumber && ` • Invoice #${invoice.invoiceNumber}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
