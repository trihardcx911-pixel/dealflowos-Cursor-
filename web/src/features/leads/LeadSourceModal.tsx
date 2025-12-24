import React, { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (source: string) => void;
}

export default function LeadSourceModal({ isOpen, onClose, onSubmit }: Props) {
  const [source, setSource] = useState("");

  if (!isOpen) return null;

  const sources = [
    { id: "cold_call", label: "Cold Call" },
    { id: "sms", label: "SMS" },
    { id: "ppc", label: "PPC" },
    { id: "driving_for_dollars", label: "Driving for Dollars" },
    { id: "referral", label: "Referral" },
    { id: "other", label: "Other" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-50">
      <div className="neon-glass rounded-xl p-6 w-[420px]">
        <h2 className="text-xl text-white mb-4">Where did you get this lead from?</h2>

        <div className="space-y-3 mb-6">
          {sources.map(src => (
            <button
              key={src.id}
              onClick={() => setSource(src.id)}
              className={`w-full py-2 rounded-md border 
                ${source === src.id 
                  ? "border-red-500 text-white bg-red-600/20" 
                  : "border-white/20 text-white/70"
                }`}
            >
              {src.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-black/40 text-white rounded-md"
          >Cancel</button>

          <button
            disabled={!source}
            onClick={() => onSubmit(source)}
            className="px-4 py-2 bg-red-500 text-white rounded-md disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}






