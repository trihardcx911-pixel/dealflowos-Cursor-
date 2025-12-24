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
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'refund':
        return <Undo2 className="w-5 h-5 text-blue-400" />;
      case 'invoice':
        return <FileText className="w-5 h-5 text-yellow-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
    }
  };

  const getBadge = () => {
    switch (row.type) {
      case 'charge':
        return (
          <span className="px-2 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-medium shadow-[0_0_8px_rgba(34,197,94,0.3)]">
            PAID
          </span>
        );
      case 'refund':
        return (
          <span className="px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-medium shadow-[0_0_8px_rgba(59,130,246,0.3)]">
            REFUNDED
          </span>
        );
      case 'invoice':
        const isOverdue = row.status === 'OVERDUE';
        return (
          <span
            className={`px-2 py-1 rounded-full border text-xs font-medium ${
              isOverdue
                ? 'bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.3)]'
            }`}
          >
            {row.status || 'OPEN'}
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-medium shadow-[0_0_8px_rgba(239,68,68,0.3)]">
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
          <span className="text-red-400 font-semibold shadow-[0_0_8px_rgba(239,68,68,0.3)]">
            -{formatted}
          </span>
        );
      case 'refund':
        return (
          <span className="text-blue-400 font-semibold shadow-[0_0_8px_rgba(59,130,246,0.3)]">
            +{formatted}
          </span>
        );
      case 'invoice':
        return <span className="text-white font-semibold">{formatted}</span>;
      case 'failed':
        return <span className="text-red-400 font-semibold">{formatted}</span>;
    }
  };

  const getActionButton = () => {
    switch (row.type) {
      case 'charge':
        return (
          <button
            onClick={() => onAction(row)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#ff0a45]/40 bg-[#ff0a45]/10 text-[#ff0a45] hover:bg-[#ff0a45]/20 hover:shadow-[0_0_8px_rgba(255,10,69,0.5)] transition-all text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Download Receipt
          </button>
        );
      case 'refund':
        return (
          <button
            onClick={() => onAction(row)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#ff0a45]/40 bg-[#ff0a45]/10 text-[#ff0a45] hover:bg-[#ff0a45]/20 hover:shadow-[0_0_8px_rgba(255,10,69,0.5)] transition-all text-xs font-medium"
          >
            <Eye className="w-3.5 h-3.5" />
            View Refund
          </button>
        );
      case 'invoice':
        return (
          <button
            onClick={() => onAction(row)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#ff0a45]/40 bg-[#ff0a45]/10 text-[#ff0a45] hover:bg-[#ff0a45]/20 hover:shadow-[0_0_8px_rgba(255,10,69,0.5)] transition-all text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Download Invoice
          </button>
        );
      case 'failed':
        return (
          <button
            onClick={() => onAction(row)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-all text-xs font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Payment
          </button>
        );
    }
  };

  return (
    <div className="bg-black/30 backdrop-blur-lg border border-white/10 shadow-[0_0_20px_rgba(255,0,80,0.35)] rounded-xl p-4 lg:p-5 transition-all duration-200 ease-in-out hover:border-[#ff0a45]/30 hover:shadow-[0_0_30px_rgba(255,10,69,0.45)]">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-[24px]">
        {/* Left: Date & Icon */}
        <div className="flex items-center gap-3 min-w-[140px]">
          {getIcon()}
          <div>
            <div className="text-sm font-medium text-white">{row.date}</div>
            <div className="text-xs text-neutral-400">{row.type.toUpperCase()}</div>
          </div>
        </div>

        {/* Middle: Description */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white mb-1">{row.description}</div>
          {row.invoiceNumber && (
            <div className="text-xs text-neutral-400">Invoice #{row.invoiceNumber}</div>
          )}
          {row.receiptNumber && (
            <div className="text-xs text-neutral-400">Receipt #{row.receiptNumber}</div>
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

