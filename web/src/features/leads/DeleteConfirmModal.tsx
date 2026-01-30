import React, { useEffect, useRef } from "react";

interface DeleteConfirmModalProps {
  lead?: any;  // Optional: for single delete mode
  count?: number;  // Optional: for bulk delete mode
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;  // Optional: for loading state (Phase 3+)
}

export default function DeleteConfirmModal({ 
  lead, 
  count, 
  onClose, 
  onConfirm,
  isDeleting = false 
}: DeleteConfirmModalProps) {
  // Single mode: lead exists
  // Bulk mode: !lead and count > 0
  // If neither lead nor valid count -> return null (no render)
  const isBulkMode = !lead && count !== undefined && count > 0;
  const isSingleMode = !!lead;
  
  if (!isSingleMode && !isBulkMode) return null;

  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: focus Cancel button when modal opens
  useEffect(() => {
    if (cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, []);

  // ESC key handler: close modal unless isDeleting
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, isDeleting]);

  // Overlay click handler: close modal unless isDeleting
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  };

  // Dialog click handler: prevent closing when clicking inside
  const handleDialogClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50"
      onClick={handleOverlayClick}
    >
      <div 
        className="neon-glass p-6 rounded-xl w-[360px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        onClick={handleDialogClick}
      >
        <h3 id="delete-confirm-title" className="text-lg mb-3">
          {isBulkMode ? 'Delete leads' : 'Delete Lead'}
        </h3>
        <p className="text-white/70 mb-4">
          {isBulkMode ? (
            <>Are you sure you want to delete <strong>{count} lead(s)</strong>?</>
          ) : (
            <>Are you sure you want to delete <strong>{lead.address}</strong>?</>
          )}
        </p>
        <div className="flex justify-end gap-4">
          <button 
            ref={cancelButtonRef}
            onClick={onClose}
            disabled={isDeleting}
            className="text-white/60 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white shadow-[0_0_10px_rgba(255,0,80,0.9)] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}







