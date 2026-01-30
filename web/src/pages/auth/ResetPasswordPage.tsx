import { useState, useEffect, FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/layout/AuthLayout'
import { verifyPasswordReset, confirmPasswordResetCode } from '../../auth/firebaseAuth'

interface PasswordCriteria {
  minLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecial: boolean
}

function validatePassword(password: string): PasswordCriteria {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*]/.test(password),
  }
}

function allCriteriaMet(criteria: PasswordCriteria): boolean {
  return Object.values(criteria).every(Boolean)
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [oobCode, setOobCode] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Extract oobCode from URL on mount
  useEffect(() => {
    const code = searchParams.get('oobCode') || searchParams.get('code')
    const mode = searchParams.get('mode')

    if (code && mode === 'resetPassword') {
      setOobCode(code)
      // Verify the code immediately
      verifyCode(code)
    } else {
      setError('This reset link is invalid or has expired.')
      setLoading(false)
    }
  }, [searchParams])

  async function verifyCode(code: string) {
    try {
      const emailAddress = await verifyPasswordReset(code)
      setEmail(emailAddress)
      setError(null)
    } catch (err: any) {
      let message = 'This reset link is invalid or has expired.'
      
      if (err?.code) {
        switch (err.code) {
          case 'auth/expired-action-code':
          case 'auth/invalid-action-code':
            message = 'This reset link is invalid or has expired.'
            break
          default:
            message = 'This reset link is invalid or has expired.'
        }
      }
      
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    // Validate password strength
    const criteria = validatePassword(password)
    if (!allCriteriaMet(criteria)) {
      setError('Password does not meet security requirements.')
      return
    }

    if (!oobCode) {
      setError('Reset code is missing.')
      return
    }

    setVerifying(true)

    try {
      await confirmPasswordResetCode(oobCode, password)
      setSuccess(true)
    } catch (err: any) {
      let message = 'Failed to reset password. Please try again.'
      
      if (err?.code) {
        switch (err.code) {
          case 'auth/expired-action-code':
          case 'auth/invalid-action-code':
            message = 'This reset link is invalid or has expired.'
            break
          case 'auth/weak-password':
            message = 'Password does not meet security requirements.'
            break
          case 'auth/too-many-requests':
            message = 'Too many attempts. Please try again later.'
            break
          default:
            message = 'Failed to reset password. Please try again.'
        }
      }
      
      setError(message)
    } finally {
      setVerifying(false)
    }
  }

  const passwordCriteria = validatePassword(password)
  const allMet = allCriteriaMet(passwordCriteria)
  const passwordsMatch = password === confirmPassword || confirmPassword === ''

  if (loading) {
    return (
      <AuthLayout
        title="Verifying reset link"
        subtitle="Please wait while we verify your password reset link."
      >
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--neon-red)]"></div>
        </div>
      </AuthLayout>
    )
  }

  if (error && !email) {
    return (
      <AuthLayout
        title="Invalid reset link"
        subtitle={error}
        footer={
          <Link to="/forgot-password" className="text-sm text-white/60 hover:text-white/80 transition-colors">
            Request a new reset link
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-white/5 border border-white/10 p-4">
            <p className="text-sm text-[var(--neon-red)] text-center">{error}</p>
          </div>
        </div>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout
        title="Password updated"
        subtitle="Your password has been updated successfully."
        footer={
          <Link 
            to="/login" 
            className="inline-block rounded-lg bg-[var(--neon-red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--neon-red)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--neon-red)]/50 transition-colors"
          >
            Return to sign in
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-white/5 border border-white/10 p-4">
            <p className="text-sm text-white/80 text-center">
              Your password has been updated successfully.
            </p>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password to protect your DealflowOS account."
      footer={
        <Link to="/login" className="text-sm text-white/60 hover:text-white/80 transition-colors">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <label className="block text-left">
            <span className="text-sm text-white/70 mb-1 block">New password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={verifying}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 pr-10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--neon-red)]/50 focus:border-[var(--neon-red)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {/* Password strength criteria */}
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1.5">
            <p className="text-xs text-white/60 mb-2">Password requirements:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className={passwordCriteria.minLength ? 'text-[var(--neon-red)]' : 'text-white/40'}>
                  {passwordCriteria.minLength ? '✓' : '○'}
                </span>
                <span className={passwordCriteria.minLength ? 'text-white/70' : 'text-white/50'}>
                  Minimum 8 characters
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={passwordCriteria.hasUppercase ? 'text-[var(--neon-red)]' : 'text-white/40'}>
                  {passwordCriteria.hasUppercase ? '✓' : '○'}
                </span>
                <span className={passwordCriteria.hasUppercase ? 'text-white/70' : 'text-white/50'}>
                  At least 1 uppercase letter
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={passwordCriteria.hasLowercase ? 'text-[var(--neon-red)]' : 'text-white/40'}>
                  {passwordCriteria.hasLowercase ? '✓' : '○'}
                </span>
                <span className={passwordCriteria.hasLowercase ? 'text-white/70' : 'text-white/50'}>
                  At least 1 lowercase letter
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={passwordCriteria.hasNumber ? 'text-[var(--neon-red)]' : 'text-white/40'}>
                  {passwordCriteria.hasNumber ? '✓' : '○'}
                </span>
                <span className={passwordCriteria.hasNumber ? 'text-white/70' : 'text-white/50'}>
                  At least 1 number
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={passwordCriteria.hasSpecial ? 'text-[var(--neon-red)]' : 'text-white/40'}>
                  {passwordCriteria.hasSpecial ? '✓' : '○'}
                </span>
                <span className={passwordCriteria.hasSpecial ? 'text-white/70' : 'text-white/50'}>
                  At least 1 special character (!@#$%^&*)
                </span>
              </div>
            </div>
          </div>

          <label className="block text-left">
            <span className="text-sm text-white/70 mb-1 block">Confirm new password</span>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={verifying}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 pr-10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--neon-red)]/50 focus:border-[var(--neon-red)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-[var(--neon-red)] mt-1">Passwords do not match.</p>
            )}
          </label>
        </div>

        {error && (
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <p className="text-sm text-[var(--neon-red)]">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={verifying || !allMet || !passwordsMatch || !password || !confirmPassword}
          className="w-full rounded-lg bg-[var(--neon-red)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--neon-red)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--neon-red)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? 'Updating password...' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  )
}

