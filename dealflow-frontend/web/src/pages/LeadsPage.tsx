import { useEffect, useState } from 'react'
import { get, post } from '../api'
import { useToast } from '../useToast'
import BackToDashboard from '../components/BackToDashboard'

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

export default function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([])
  const [form, setForm] = useState(defaultLead)
  const [error, setError] = useState<string | null>(null)
  const { notify } = useToast()

  async function refresh() {
    setError(null)
    try {
      const res = await get<{ items: Lead[] }>('/leads')
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

  async function createLead(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await post('/leads', form)
      notify('success', 'Lead created')
      await refresh()
      setForm(defaultLead)
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Unable to create lead'
      setError(msg)
      notify('error', msg)
    }
  }

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm({ ...form, [key]: value })
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
        onSubmit={createLead}
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
          className={`${buttonClass} md:col-span-6`}
          type="submit"
          style={{
            background: 'rgba(255,10,69,0.2)',
          }}
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
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td
                  colSpan={6}
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
    </div>
  )
}
