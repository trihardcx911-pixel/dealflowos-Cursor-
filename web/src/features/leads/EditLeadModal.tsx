import React from "react";

interface EditLeadModalProps {
  lead: any;
  onClose: () => void;
  onSave: (updated: any) => void;
}

export default function EditLeadModal({ lead, onClose, onSave }: EditLeadModalProps) {
  if (!lead) return null;

  const [form, setForm] = React.useState(lead);
  const [isSaving, setIsSaving] = React.useState(false);

  // Silver gating
  // DFOS_FEATURE_MILESTONES is dev override only; production uses DFOS_PLAN_TIER
  const isSilver = localStorage.getItem("DFOS_PLAN_TIER") === "silver";
  const milestonesEnabled = isSilver || localStorage.getItem("DFOS_FEATURE_MILESTONES") === "1";
  // Note: No backend enforcement in this phase (UI-only gating)

  const update = (k: string, v: any) => setForm({ ...form, [k]: v });

  // Validation: assignedAt requires buyerName
  const canSave = !form.assignedAt || (form.assignedAt && form.buyerName?.trim());
  const buyerNameError = form.assignedAt && !form.buyerName?.trim() 
    ? "Buyer name is required when lead is assigned" 
    : null;

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

        {/* Deal Milestones (Silver) */}
        {milestonesEnabled ? (
          <div className="mt-6 pt-4 border-t border-white/10">
            <h4 className="text-sm font-semibold text-white/80 mb-3">Deal Milestones (Silver)</h4>
            
            {/* Under Contract */}
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={!!form.underContractAt}
                onChange={(e) => update("underContractAt", e.target.checked ? new Date().toISOString() : null)}
                disabled={isSaving}
                className="tron-checkbox"
              />
              <label className="text-sm text-white/70">Under Contract</label>
              {form.underContractAt && (
                <span className="text-xs text-white/50">
                  {new Date(form.underContractAt).toLocaleDateString()}
                </span>
              )}
            </div>
            
            {/* Assigned */}
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={!!form.assignedAt}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  update("assignedAt", isChecked ? new Date().toISOString() : null);
                  if (!isChecked) update("buyerName", null);
                }}
                disabled={isSaving}
                className="tron-checkbox"
              />
              <label className="text-sm text-white/70">Assigned</label>
              {form.assignedAt && (
                <>
                  <input
                    value={form.buyerName || ""}
                    onChange={(e) => update("buyerName", e.target.value)}
                    placeholder="Buyer name (required)"
                    disabled={isSaving}
                    className="flex-1 px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40"
                  />
                  <span className="text-xs text-white/50">
                    {new Date(form.assignedAt).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
            {buyerNameError && (
              <p className="text-xs text-red-400 mb-2">{buyerNameError}</p>
            )}
            
            {/* Escrow Opened */}
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={!!form.escrowOpenedAt}
                onChange={(e) => update("escrowOpenedAt", e.target.checked ? new Date().toISOString() : null)}
                disabled={isSaving}
                className="tron-checkbox"
              />
              <label className="text-sm text-white/70">Escrow Opened</label>
              {form.escrowOpenedAt && (
                <span className="text-xs text-white/50">
                  {new Date(form.escrowOpenedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            
            {/* Closed */}
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={!!form.closedAt}
                onChange={(e) => update("closedAt", e.target.checked ? new Date().toISOString() : null)}
                disabled={isSaving}
                className="tron-checkbox"
              />
              <label className="text-sm text-white/70">Closed</label>
              {form.closedAt && (
                <span className="text-xs text-white/50">
                  {new Date(form.closedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            
            {/* Cancelled */}
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={!!form.cancelledAt}
                onChange={(e) => update("cancelledAt", e.target.checked ? new Date().toISOString() : null)}
                disabled={isSaving}
                className="tron-checkbox"
              />
              <label className="text-sm text-white/70">Cancelled</label>
              {form.cancelledAt && (
                <span className="text-xs text-white/50">
                  {new Date(form.cancelledAt).toLocaleDateString()}
                </span>
              )}
            </div>
            
            {/* Assignment Fee */}
            <div className="mt-3">
              <label className="text-xs text-white/60 block mb-1">Assignment Fee ($)</label>
              <input
                type="number"
                value={form.assignmentFee ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  // Store as string to match DB Decimal type (round-trip safety)
                  // Allow empty string during typing; convert to null when cleared
                  update("assignmentFee", val === "" ? null : val);
                }}
                placeholder="0.00"
                step="0.01"
                min="0"
                disabled={isSaving}
                className="w-full px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white placeholder:text-white/40"
              />
            </div>
          </div>
        ) : (
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-white/50 italic">Deal Milestones (Silver tier feature)</p>
          </div>
        )}

        <div className="flex justify-end gap-4 mt-5">
          <button 
            onClick={onClose} 
            className="text-white/60 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!canSave) return;
              setIsSaving(true);
              try {
                await onSave(form);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving || !canSave}
            className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white shadow-[0_0_8px_rgba(255,0,80,0.7)] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}







