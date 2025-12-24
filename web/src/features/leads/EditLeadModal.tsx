import React from "react";

interface EditLeadModalProps {
  lead: any;
  onClose: () => void;
  onSave: (updated: any) => void;
}

export default function EditLeadModal({ lead, onClose, onSave }: EditLeadModalProps) {
  if (!lead) return null;

  const [form, setForm] = React.useState(lead);

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="neon-glass p-6 rounded-xl w-[420px] shadow-xl">
        <h3 className="text-xl mb-4">Edit Lead</h3>
        <div className="space-y-3">
          <input 
            value={form.type} 
            onChange={(e) => update("type", e.target.value)} 
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60" 
            placeholder="Type"
          />
          <input 
            value={form.address} 
            onChange={(e) => update("address", e.target.value)} 
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60" 
            placeholder="Address"
          />
          <input 
            value={form.city} 
            onChange={(e) => update("city", e.target.value)} 
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60" 
            placeholder="City"
          />
          <input 
            value={form.state} 
            onChange={(e) => update("state", e.target.value.toUpperCase().slice(0, 2))} 
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60" 
            placeholder="State"
          />
          <input 
            value={form.zip} 
            onChange={(e) => update("zip", e.target.value.replace(/[^\d]/g, "").slice(0, 5))} 
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60" 
            placeholder="Zip"
          />
        </div>
        <div className="flex justify-end gap-4 mt-5">
          <button 
            onClick={onClose} 
            className="text-white/60 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white shadow-[0_0_8px_rgba(255,0,80,0.7)] transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}







