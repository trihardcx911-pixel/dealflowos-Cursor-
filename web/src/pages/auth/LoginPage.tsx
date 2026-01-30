import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import AuthLayout from '../../components/layout/AuthLayout'
import { post, setToken, ApiError, NetworkError, API_BASE } from '../../api'
import { useToast } from '../../useToast'
import { signInWithGoogle, sendEmailLink } from '../../auth/firebaseAuth'

export default function LoginPage() {
  const [email, setEmail] = useState('user@example.com')
  const [password, setPassword] = useState('testpass123')
  const [error, setError] = useState<string | null>(null)
  const [emailLinkSent, setEmailLinkSent] = useState(false)
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false)
  const { notify } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  // Check if redirected from password reset
  useEffect(() => {
    if ((location.state as { passwordReset?: boolean } | null)?.passwordReset) {
      setPasswordResetSuccess(true)
      // Clear the state from URL
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await post<{ token: string }>(`${API_BASE}/auth/login`, { email, password })
      setToken(res.token)
      notify('success', 'Logged in')
      // Check for plan param from signup flow
      const plan = (location.state as { plan?: string } | null)?.plan
      if (plan) {
        navigate(`/billing/redirect?plan=${plan}`, { replace: true })
      } else {
        const redirectTo = (location.state as { from?: string } | null)?.from || '/leads'
        navigate(redirectTo, { replace: true })
      }
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

  async function handleGoogleSignIn() {
    setError(null)
    try {
      await signInWithGoogle()
      console.log('Google sign-in successful')
    } catch (err) {
      console.error('Google sign-in error:', err)
      const message = err instanceof Error ? err.message : 'Google sign-in failed'
      setError(message)
    }
  }

  async function handleEmailLinkSignIn() {
    if (!email) {
      setError('Please enter your email address')
      return
    }
    setError(null)
    try {
      await sendEmailLink(email)
      setEmailLinkSent(true)
      console.log('Email link sent successfully')
    } catch (err) {
      console.error('Email link error:', err)
      const message = err instanceof Error ? err.message : 'Failed to send email link'
      setError(message)
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use the credentials you created on the backend."
      footer={
        <div className="space-y-2">
          <span>
            New here?{' '}
            <Link to="/signup" className="text-blue-600 hover:text-blue-500 transition-colors">
              Create an account
            </Link>
          </span>
          <div>
            <Link to="/forgot-password" className="text-sm text-white/60 hover:text-white/80 transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>
      }
    >
      {passwordResetSuccess && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 mb-4">
          <p className="text-sm text-green-400 text-center">
            Your password has been successfully updated. Please sign in with your new password.
          </p>
        </div>
      )}

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

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 text-slate-500" style={{ background: 'transparent' }}>Or continue with</span>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleEmailLinkSignIn}
            disabled={emailLinkSent}
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {emailLinkSent ? 'Check your email for sign-in link' : 'Sign in with Email Link'}
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}
