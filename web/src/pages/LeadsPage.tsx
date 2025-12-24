import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useToast } from '../useToast'
import BackToDashboard from '../components/BackToDashboard'
import EditLeadModal from '../features/leads/EditLeadModal'
import DeleteConfirmModal from '../features/leads/DeleteConfirmModal'
import LeadSourceModal from '../features/leads/LeadSourceModal'

type Lead = {
  id: string
  type: string
  address: string
  city: string
  state: string
  zip: string
  createdBy?: string | null
  createdAt?: string
  updatedAt?: string
}

const defaultLead: Omit<Lead, 'id'> = {
  type: 'single_family',
  address: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
}

const inputClass =
  'neon-glass w-full px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60'

const buttonClass =
  'neon-glass px-4 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-[#ff0a45]/20'

function sanitizeLeadInput(form: any) {
  const clean = {
    type: String(form.type ?? "").trim(),
    address: String(form.address ?? "").trim(),
    city: String(form.city ?? "").trim(),
    state: String(form.state ?? "").trim().toUpperCase(),
    zip: String(form.zip ?? "").trim(),
  };

  // Basic ZIP cleanup
  clean.zip = clean.zip.replace(/[^\d]/g, ""); // remove non-numbers

  return clean;
}

function validateLead(form: any): string | null {
  if (!form.address) return "Address is required";
  if (!form.city) return "City is required";
  if (!form.state || form.state.length !== 2)
    return "State must be a 2-letter abbreviation";
  if (!/^\d{5}$/.test(form.zip))
    return "ZIP code must be 5 digits";

  return null; // no errors
}

export default function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([])
  const [form, setForm] = useState(defaultLead)
  const [error, setError] = useState<string | null>(null)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null)
  const [isSourceModalOpen, setSourceModalOpen] = useState(false)
  const [pendingLeadData, setPendingLeadData] = useState<any>(null)
  const { notify } = useToast()

  async function refresh() {
    setError(null)
    try {
      const res = await api.get<{ items: Lead[] }>('/leads')
      setItems(res.items)
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Unable to load leads'
      setError(msg)
      notify('error', msg)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreateLeadClick(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const clean = sanitizeLeadInput(form);
    const validationError = validateLead(clean);

    if (validationError) {
      notify("error", validationError);
      setError(validationError);
      return;
    }

    // Store pending lead data and open source modal
    setPendingLeadData(clean);
    setSourceModalOpen(true);
  }

  async function handleSourceSubmit(source: string) {
    setSourceModalOpen(false);

    const finalPayload = {
      ...pendingLeadData,
      source,
    };

    try {
      await api.post("/leads", finalPayload);
      notify("success", "Lead created");

      await refresh();
      setForm(defaultLead);
      setPendingLeadData(null);
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || "Unable to create lead";
      setError(msg);
      notify("error", msg);
    }
  }

  function setField<K extends keyof typeof form>(key: K, value: string) {
    let cleaned = value;

    // Real-time sanitization rules
    if (key === "state") cleaned = value.toUpperCase().slice(0, 2);
    if (key === "zip") cleaned = value.replace(/[^\d]/g, "").slice(0, 5);

    setForm({ ...form, [key]: cleaned });
  }

  async function handleSaveLead(updated: Lead) {
    try {
      await api.patch(`/leads/${updated.id}`, updated);
      setEditingLead(null);
      notify("success", "Lead updated");
      await refresh();
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || "Unable to update lead";
      notify("error", msg);
    }
  }

  async function handleDeleteLead(lead: Lead) {
    try {
      await api.delete(`/leads/${lead.id}`);
      setDeletingLead(null);
      notify("success", "Lead deleted");
      await refresh();
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || "Unable to delete lead";
      notify("error", msg);
    }
  }

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Pipeline
        </p>
        <h1 className="text-3xl font-semibold text-white">Leads</h1>
        <p className="text-sm text-slate-400">
          Create deals, import lists, and watch the board light up.
        </p>
      </header>

      <form
        onSubmit={handleCreateLeadClick}
        className="neon-glass p-6 md:p-8 grid gap-3 md:grid-cols-6 text-sm"
      >
        <input
          className={inputClass}
          placeholder="Type"
          value={form.type}
          onChange={(e) => setField('type', e.target.value)}
        />
        <input
          className={`${inputClass} md:col-span-2`}
          placeholder="Address"
          value={form.address}
          onChange={(e) => setField('address', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="City"
          value={form.city}
          onChange={(e) => setField('city', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="State"
          value={form.state}
          onChange={(e) => setField('state', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Zip"
          value={form.zip}
          onChange={(e) => setField('zip', e.target.value)}
        />
        <button
          className={`${buttonClass} md:col-span-6 glass-tile neon-border`}
          type="submit"
        >
          Create lead
        </button>
      </form>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="neon-glass overflow-hidden text-sm">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.25em] text-white/60">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Zip</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((lead) => (
              <tr
                key={lead.id}
                className="border-t border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-3 capitalize text-white">
                  {lead.type}
                </td>
                <td className="px-4 py-3 text-white">{lead.address}</td>
                <td className="px-4 py-3 text-white">{lead.city}</td>
                <td className="px-4 py-3 text-white">{lead.state}</td>
                <td className="px-4 py-3 text-white">{lead.zip}</td>
                <td className="px-4 py-3 text-xs text-white/60">
                  {lead.updatedAt ?? '—'}
                </td>
                <td className="px-4 py-3 text-right pr-4">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEditingLead(lead)}
                      className="text-white/70 hover:text-white transition drop-shadow-[0_0_4px_rgba(255,0,80,0.5)]"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeletingLead(lead)}
                      className="text-red-400 hover:text-red-500 transition drop-shadow-[0_0_6px_rgba(255,0,80,0.8)]"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-white/60"
                >
                  No leads yet. Use the form above to create one or import a
                  list.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <EditLeadModal
        lead={editingLead}
        onClose={() => setEditingLead(null)}
        onSave={handleSaveLead}
      />

      <DeleteConfirmModal
        lead={deletingLead}
        onClose={() => setDeletingLead(null)}
        onConfirm={() => deletingLead && handleDeleteLead(deletingLead)}
      />

      <LeadSourceModal
        isOpen={isSourceModalOpen}
        onClose={() => {
          setSourceModalOpen(false);
          setPendingLeadData(null);
        }}
        onSubmit={handleSourceSubmit}
      />
    </div>
  )
}
