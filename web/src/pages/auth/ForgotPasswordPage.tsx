import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../../components/layout/AuthLayout'
import { sendPasswordReset } from '../../auth/firebaseAuth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await sendPasswordReset(email)
      setSuccess(true)
    } catch (err: any) {
      let message = 'Failed to send reset link. Please try again.'
      
      // Check if it's a Firebase error
      if (err?.code) {
        switch (err.code) {
          case 'auth/invalid-email':
            message = 'Enter a valid email address.'
            break
          case 'auth/too-many-requests':
            message = 'Too many attempts. Try again later.'
            break
          case 'auth/user-not-found':
            // Don't reveal that the email doesn't exist
            // Show success message anyway for security
            setSuccess(true)
            setLoading(false)
            return
          default:
            // Generic error for all other cases
            message = 'Failed to send reset link. Please try again.'
        }
      }
      
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout
        title="Reset your password"
        subtitle="Check your email for a password reset link."
        footer={
          <Link to="/login" className="text-sm text-white/60 hover:text-white/80 transition-colors">
            Back to sign in
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-white/5 border border-white/10 p-4">
            <p className="text-sm text-white/80 text-center">
              If an account exists for this email, a password reset link has been sent.
            </p>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email associated with your account. If an account exists, we'll send you a reset link."
      footer={
        <Link to="/login" className="text-sm text-white/60 hover:text-white/80 transition-colors">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-left">
          <span className="text-sm text-white/70 mb-1 block">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--neon-red)]/50 focus:border-[var(--neon-red)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full rounded-lg bg-[var(--neon-red)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--neon-red)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--neon-red)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  )
}

