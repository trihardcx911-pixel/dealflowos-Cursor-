import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmText = 'Continue',
  cancelText = 'Cancel',
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[10000] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 bg-[#0a0a0c] border border-[#ff0a45]/40 shadow-[0_0_30px_rgba(255,10,69,0.3)] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h3 className="text-lg font-semibold text-white mb-3">
          {title}
        </h3>

        {/* Message */}
        <p className="text-sm text-neutral-300 mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-[#080712]/60 text-neutral-300 hover:border-[#ff0a45]/30 hover:text-[#ff0a45] transition-all text-xs font-medium"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_8px_#ff0a45] hover:shadow-[0_0_12px_#ff0a45] transition-all text-xs font-medium"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};











