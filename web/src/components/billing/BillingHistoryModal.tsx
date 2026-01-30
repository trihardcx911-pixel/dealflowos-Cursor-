import React from 'react';
import { X, Download } from 'lucide-react';
import { BillingRowData } from './BillingRow';

interface BillingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: BillingRowData | null;
  onDownload?: () => void;
}

export const BillingHistoryModal: React.FC<BillingHistoryModalProps> = ({
  isOpen,
  onClose,
  row,
  onDownload,
}) => {
  if (!isOpen || !row) return null;

  const renderContent = () => {
    switch (row.type) {
      case 'charge':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-neutral-400 mb-2">Receipt Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Receipt Number:</span>
                  <span className="text-slate-900 dark:text-white font-mono">{row.receiptNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Card Used:</span>
                  <span className="text-slate-900 dark:text-white">•••• 8794</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Amount:</span>
                  <span className="text-slate-900 dark:text-white font-semibold">${row.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Date:</span>
                  <span className="text-slate-900 dark:text-white">{row.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Billing Address:</span>
                  <span className="text-slate-900 dark:text-white">427 Bloomfield Ave Newark NJ 07107</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'refund':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-neutral-400 mb-2">Refund Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Refund Amount:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">+${row.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Date:</span>
                  <span className="text-slate-900 dark:text-white">{row.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Reason:</span>
                  <span className="text-slate-900 dark:text-white">{row.refundReason || 'Customer request'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Status:</span>
                  <span className="text-blue-600 dark:text-blue-400">Refunded</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'invoice':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-neutral-400 mb-2">Invoice Details</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Invoice Number:</span>
                  <span className="text-slate-900 dark:text-white font-mono">{row.invoiceNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Date:</span>
                  <span className="text-slate-900 dark:text-white">{row.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Status:</span>
                  <span
                    className={`${
                      row.status === 'OVERDUE' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                    }`}
                  >
                    {row.status || 'OPEN'}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                <h4 className="text-sm font-medium text-slate-500 dark:text-neutral-400 mb-3">Line Items</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-900 dark:text-white">Pro Plan Subscription</span>
                    <span className="text-slate-900 dark:text-white">${(row.amount * 0.9).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-900 dark:text-white">Tax</span>
                    <span className="text-slate-900 dark:text-white">${(row.amount * 0.1).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-white/10">
                    <span className="text-slate-900 dark:text-white font-semibold">Total</span>
                    <span className="text-slate-900 dark:text-white font-semibold">${row.amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'failed':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-neutral-400 mb-2">Failed Payment</h3>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Amount:</span>
                  <span className="text-red-600 dark:text-red-400 font-semibold">${row.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Date:</span>
                  <span className="text-slate-900 dark:text-white">{row.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Status:</span>
                  <span className="text-red-600 dark:text-red-400">Failed</span>
                </div>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Retry Instructions</h4>
                <p className="text-xs text-slate-600 dark:text-neutral-300">
                  This payment failed due to insufficient funds or card issues. Please update your
                  payment method and try again. The charge will be retried automatically in 3 days.
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  const showDownload = row.type === 'charge' || row.type === 'invoice';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/55 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-white border border-slate-200/70 shadow-[0_30px_90px_rgba(2,6,23,0.15)] mx-4 dark:bg-[#07070a] dark:border-white/10 dark:shadow-[0_30px_90px_rgba(0,0,0,0.75)] dark:ring-1 dark:ring-[#ff0a45]/15"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {row.type === 'charge' && 'Receipt Details'}
            {row.type === 'refund' && 'Refund Details'}
            {row.type === 'invoice' && 'Invoice Details'}
            {row.type === 'failed' && 'Failed Payment'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-neutral-400 hover:text-[#ff0a45] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4">{renderContent()}</div>

        {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#080712]/60 text-slate-700 dark:text-neutral-300 hover:border-[#ff0a45]/30 hover:text-[#ff0a45] transition-all text-xs font-medium"
          >
            Close
          </button>
          {showDownload && onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="flex-1 px-4 py-2 rounded-lg border border-[#ff0a45]/25 bg-[#ff0a45]/8 text-[#ff0a45] hover:bg-[#ff0a45]/12 transition-all text-xs font-medium dark:bg-[#ff0a45]/10 dark:text-[#ff4d73] dark:hover:bg-[#ff0a45]/15 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
};











