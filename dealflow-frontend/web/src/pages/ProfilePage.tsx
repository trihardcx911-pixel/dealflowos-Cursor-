import { useEffect, useState } from 'react'
import { get } from '../api'
import BackToDashboard from '../components/BackToDashboard'

export default function ProfilePage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const payload = await get('/me')
        setData(payload)
      } catch (e: any) {
        setError(e?.error?.message || e?.message || 'Unable to load profile')
      }
    })()
  }, [])

  return (
    <section className="space-y-4">
      <BackToDashboard />
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">My profile</h1>
        <p className="text-sm text-slate-500">Raw payload returned from /me while the UI is still evolving.</p>
      </header>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-900 p-4 text-sm text-white">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  )
}
