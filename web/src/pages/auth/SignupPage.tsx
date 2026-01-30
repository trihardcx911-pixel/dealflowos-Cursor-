import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../../components/layout/AuthLayout'
import { post, API_BASE } from '../../api'
import { useToast } from '../../useToast'

export default function SignupPage() {
  const [email, setEmail] = useState('user+' + Date.now() + '@example.com')
  const [password, setPassword] = useState('testpass123')
  const [loading, setLoading] = useState(false)
  const { notify } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const plan = searchParams.get('plan')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await post(`${API_BASE}/auth/signup`, { email, password })
      notify('success', 'Signed up! Please login.')
      // Preserve plan param through login flow
      if (plan) {
        navigate('/login', { state: { plan } })
      } else {
        navigate('/login')
      }
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
          <Link to="/login" className="text-[var(--neon-red-soft)] hover:text-[var(--neon-red)] transition-colors">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-left text-sm text-white/80">
          Email
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-white/95 placeholder:text-white/40 focus:outline-none transition-all"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(255, 0, 51, 0.4)'
              e.target.style.boxShadow = '0 0 12px rgba(255, 0, 51, 0.2)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.target.style.boxShadow = 'none'
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-left text-sm text-white/80">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-md border px-3 py-2 text-white/95 placeholder:text-white/40 focus:outline-none transition-all"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(255, 0, 51, 0.4)'
              e.target.style.boxShadow = '0 0 12px rgba(255, 0, 51, 0.2)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.target.style.boxShadow = 'none'
            }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md px-4 py-2 text-sm font-semibold text-white/95 disabled:opacity-60 transition-all"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.borderColor = 'rgba(255, 0, 51, 0.5)'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 0, 51, 0.3)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {loading ? 'Working…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
