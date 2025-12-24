import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/layout/AuthLayout'
import { post, API_BASE } from '../../api'
import { useToast } from '../../useToast'

export default function SignupPage() {
  const [email, setEmail] = useState('user+' + Date.now() + '@example.com')
  const [password, setPassword] = useState('testpass123')
  const [loading, setLoading] = useState(false)
  const { notify } = useToast()
  const navigate = useNavigate()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await post(`${API_BASE}/auth/signup`, { email, password })
      notify('success', 'Signed up! Please login.')
      navigate('/login')
    } catch (e: any) {
      notify('error', e?.error?.message || e?.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Access to the CRM is still invite-only. Use backend-created credentials."
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-left text-sm text-slate-600">
          Email
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-left text-sm text-slate-600">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'Working…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
