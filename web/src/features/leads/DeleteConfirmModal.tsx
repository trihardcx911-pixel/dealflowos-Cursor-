import React from "react";

interface DeleteConfirmModalProps {
  lead: any;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ lead, onClose, onConfirm }: DeleteConfirmModalProps) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="neon-glass p-6 rounded-xl w-[360px]">
        <h3 className="text-lg mb-3">Delete Lead</h3>
        <p className="text-white/70 mb-4">
          Are you sure you want to delete <strong>{lead.address}</strong>?
        </p>
        <div className="flex justify-end gap-4">
          <button 
            onClick={onClose} 
            className="text-white/60 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white shadow-[0_0_10px_rgba(255,0,80,0.9)] transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}







