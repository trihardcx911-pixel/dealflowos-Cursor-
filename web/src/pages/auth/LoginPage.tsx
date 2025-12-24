import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import AuthLayout from '../../components/layout/AuthLayout'
import { post, setToken, ApiError, NetworkError, API_BASE } from '../../api'
import { useToast } from '../../useToast'

export default function LoginPage() {
  const [email, setEmail] = useState('user@example.com')
  const [password, setPassword] = useState('testpass123')
  const [error, setError] = useState<string | null>(null)
  const { notify } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await post<{ token: string }>(`${API_BASE}/auth/login`, { email, password })
      setToken(res.token)
      notify('success', 'Logged in')
      const redirectTo = (location.state as { from?: string } | null)?.from || '/leads'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      let message = 'Login failed'
      if (err instanceof NetworkError) {
        message = 'Login request failed: cannot reach backend. Make sure the server is running.'
      } else if (err instanceof ApiError) {
        const suffix = err.status ? ` (${err.status})` : ''
        message = `Login failed${suffix}: ${err.message}`
      } else if (err instanceof Error) {
        message = err.message
      }
      setError(message)
      notify('error', message)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use the credentials you created on the backend."
      footer={
        <span>
          New here?{' '}
          <Link to="/signup" className="text-blue-600">
            Create an account
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
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </AuthLayout>
  )
}
