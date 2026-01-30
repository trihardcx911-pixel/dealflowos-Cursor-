import React from 'react';
import { CheckCircle2, Undo2, FileText, XCircle, Download, Eye, RotateCcw } from 'lucide-react';

export type BillingRowType = 'charge' | 'refund' | 'invoice' | 'failed';

export interface BillingRowData {
  id: string;
  type: BillingRowType;
  date: string;
  description: string;
  amount: number;
  status?: 'OPEN' | 'OVERDUE';
  invoiceNumber?: string;
  receiptNumber?: string;
  refundReason?: string;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
}

interface BillingRowProps {
  row: BillingRowData;
  onAction: (row: BillingRowData) => void;
}

export const BillingRow: React.FC<BillingRowProps> = ({ row, onAction }) => {
  const getIcon = () => {
    switch (row.type) {
      case 'charge':
        return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'refund':
        return <Undo2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'invoice':
        return <FileText className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
    }
  };

  const getBadge = () => {
    switch (row.type) {
      case 'charge':
        return (
          <span className="px-2 py-1 rounded-full bg-green-500/10 border border-green-500/25 text-green-600 dark:text-green-300 text-xs font-medium">
            PAID
          </span>
        );
      case 'refund':
        return (
          <span className="px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-300 text-xs font-medium">
            REFUNDED
          </span>
        );
      case 'invoice':
        const isOverdue = row.status === 'OVERDUE';
        return (
          <span
            className={`px-2 py-1 rounded-full border text-xs font-medium ${
              isOverdue
                ? 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-300'
                : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-600 dark:text-yellow-300'
            }`}
          >
            {row.status || 'OPEN'}
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-300 text-xs font-medium">
            FAILED
          </span>
        );
    }
  };

  const getAmountDisplay = () => {
    const formatted = `$${Math.abs(row.amount).toFixed(2)}`;
    switch (row.type) {
      case 'charge':
        return (
          <span className="text-rose-600 dark:text-rose-300 font-semibold">
            -{formatted}
          </span>
        );
      case 'refund':
        return (
          <span className="text-sky-600 dark:text-sky-300 font-semibold">
            +{formatted}
          </span>
        );
      case 'invoice':
        return <span className="text-slate-900 dark:text-white/85 font-semibold">{formatted}</span>;
      case 'failed':
        return <span className="text-rose-600 dark:text-rose-300 font-semibold">{formatted}</span>;
    }
  };

  const getActionButton = () => {
    switch (row.type) {
      case 'charge':
        return (
          <button
            onClick={() => onAction(row)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#ff0a45]/25 bg-[#ff0a45]/8 text-[#ff0a45] hover:bg-[#ff0a45]/12 transition-all text-xs font-medium dark:bg-[#ff0a45]/10 dark:text-[#ff4d73] dark:hover:bg-[#ff0a45]/15 dark:hover:border-[#ff0a45]/35"
          >
            <Download className="w-3.5 h-3.5" />
            Download Receipt
          </button>
        );
      case 'refund':
        return (
          <button
            onClick={() => onAction(row)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#ff0a45]/25 bg-[#ff0a45]/8 text-[#ff0a45] hover:bg-[#ff0a45]/12 transition-all text-xs font-medium dark:bg-[#ff0a45]/10 dark:text-[#ff4d73] dark:hover:bg-[#ff0a45]/15 dark:hover:border-[#ff0a45]/35"
          >
            <Eye className="w-3.5 h-3.5" />
            View Refund
          </button>
        );
      case 'invoice':
        return (
          <button
            onClick={() => onAction(row)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#ff0a45]/25 bg-[#ff0a45]/8 text-[#ff0a45] hover:bg-[#ff0a45]/12 transition-all text-xs font-medium dark:bg-[#ff0a45]/10 dark:text-[#ff4d73] dark:hover:bg-[#ff0a45]/15 dark:hover:border-[#ff0a45]/35"
          >
            <Download className="w-3.5 h-3.5" />
            Download Invoice
          </button>
        );
      case 'failed':
        return (
          <button
            onClick={() => onAction(row)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/25 bg-red-500/10 text-red-600 hover:bg-red-500/14 transition-all text-xs font-medium dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/15"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Payment
          </button>
        );
    }
  };

  return (
    <div className="backdrop-blur-lg rounded-xl p-4 lg:p-5 transition-all duration-200 ease-in-out bg-white/65 border border-slate-200/70 shadow-[0_14px_40px_rgba(2,6,23,0.10)] hover:border-[#ff0a45]/20 hover:shadow-[0_18px_50px_rgba(2,6,23,0.12)] dark:bg-black/25 dark:border-white/10 dark:shadow-[0_0_18px_rgba(255,10,69,0.18)] dark:hover:border-[#ff0a45]/26 dark:hover:shadow-[0_0_24px_rgba(255,10,69,0.22)]">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-[24px]">
        {/* Left: Date & Icon */}
        <div className="flex items-center gap-3 min-w-[140px]">
          {getIcon()}
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">{row.date}</div>
            <div className="text-xs text-slate-500 dark:text-neutral-400">{row.type.toUpperCase()}</div>
          </div>
        </div>

        {/* Middle: Description */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-900 dark:text-white mb-1">{row.description}</div>
          {row.invoiceNumber && (
            <div className="text-xs text-slate-500 dark:text-neutral-400">Invoice #{row.invoiceNumber}</div>
          )}
          {row.receiptNumber && (
            <div className="text-xs text-slate-500 dark:text-neutral-400">Receipt #{row.receiptNumber}</div>
          )}
        </div>

        {/* Right: Amount, Badge, Action */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="text-lg font-semibold">{getAmountDisplay()}</div>
            {getBadge()}
          </div>
          <div className="flex-shrink-0">{getActionButton()}</div>
        </div>
      </div>
    </div>
  );
};

