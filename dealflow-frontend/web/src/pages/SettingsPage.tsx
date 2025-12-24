import { useState } from 'react'
import BackToDashboard from '../components/BackToDashboard'

export default function SettingsPage() {
  const [profile, setProfile] = useState({ organization: 'Wholesale CRM', timezone: 'America/Chicago' })

  function update<K extends keyof typeof profile>(key: K, value: string) {
    setProfile({ ...profile, [key]: value })
  }

  return (
    <section className="space-y-4">
      <BackToDashboard />
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Update simple workspace metadata.</p>
      </header>
      <form className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <label className="block text-sm text-slate-700">
          Organization
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={profile.organization}
            onChange={(e) => update('organization', e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-700">
          Timezone
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={profile.timezone}
            onChange={(e) => update('timezone', e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save (local only)
        </button>
        <p className="text-xs text-slate-500">TODO: Wire this form to the actual user settings API.</p>
      </form>
    </section>
  )
}
