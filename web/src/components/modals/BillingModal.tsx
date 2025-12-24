import React from 'react';
import { X } from 'lucide-react';

interface BillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BillingModal: React.FC<BillingModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/40 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-[#0a0a0c] border border-[#ff0a45]/40 shadow-[0_0_40px_rgba(255,10,69,0.3)] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Manage Billing
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-[#ff0a45] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-8">
          <p className="text-center text-neutral-400">
            Billing management coming soon
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-[#080712]/60 text-neutral-300 hover:border-[#ff0a45]/30 hover:text-[#ff0a45] transition-all text-xs font-medium"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_8px_#ff0a45] hover:shadow-[0_0_12px_#ff0a45] transition-all text-xs font-medium"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

