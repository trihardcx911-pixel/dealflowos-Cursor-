import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CreditCard } from 'lucide-react';

interface BillingCardData {
  last4: string;
  exp: string;
  name: string;
  address: string;
  default: boolean;
}

interface BillingCardProps {
  card: BillingCardData;
  onSetDefault?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

export const BillingCard: React.FC<BillingCardProps> = ({
  card,
  onSetDefault,
  onEdit,
  onRemove,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="rounded-xl bg-[#0a0a0c]/60 border border-[#ff0a45]/25 backdrop-blur-xl shadow-[0_0_20px_rgba(255,10,69,0.12)] p-6 md:p-8 transition-all duration-200 ease-in-out hover:border-[#ff0a45]/40 hover:shadow-[0_0_30px_rgba(255,10,69,0.18)]"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
        {/* Card Brand Icon */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[#ff0a45]/10 border border-[#ff0a45]/30 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-[#ff0a45]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              •••• •••• •••• {card.last4}
            </div>
            <div className="text-xs text-neutral-400">Expires {card.exp}</div>
          </div>
        </div>

        {/* Cardholder Name */}
        <div className="text-sm text-white">
          <div className="text-neutral-400 text-xs mb-1">Cardholder</div>
          <div className="font-medium">{card.name}</div>
        </div>

        {/* Billing Address */}
        <div className="text-sm text-white">
          <div className="text-neutral-400 text-xs mb-1">Billing Address</div>
          <div className="font-medium line-clamp-2">{card.address}</div>
        </div>

        {/* Default Badge & Expand Button */}
        <div className="flex items-center justify-between md:justify-end gap-3">
          {card.default && (
            <span className="px-3 py-1 rounded-full bg-[#ff0a45]/20 border border-[#ff0a45]/40 text-[#ff0a45] text-xs font-medium shadow-[0_0_8px_rgba(255,10,69,0.3)]">
              Default
            </span>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-neutral-400 hover:text-[#ff0a45] transition-colors p-1"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Actions */}
      <div
        className={`mt-6 pt-6 border-t border-white/10 transition-all duration-200 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-wrap gap-3 justify-end">
          {!card.default && onSetDefault && (
            <button
              onClick={onSetDefault}
              className="px-4 py-2 rounded-lg border border-[#ff0a45]/40 bg-[#ff0a45]/10 text-[#ff0a45] hover:bg-[#ff0a45]/20 hover:shadow-[0_0_8px_rgba(255,10,69,0.5)] transition-all text-sm font-medium"
            >
              Change Default
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 rounded-lg border border-[#ff0a45]/40 bg-[#ff0a45]/10 text-[#ff0a45] hover:bg-[#ff0a45]/20 hover:shadow-[0_0_8px_rgba(255,10,69,0.5)] transition-all text-sm font-medium"
            >
              Edit
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="px-4 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-all text-sm font-medium"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
};











