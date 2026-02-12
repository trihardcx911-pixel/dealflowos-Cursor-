import { useState, useEffect, FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
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

const DEV_DIAGNOSTICS = import.meta.env.DEV && import.meta.env.VITE_DEV_DIAGNOSTICS === '1'

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

  // Read only mode and oobCode from URL (ignore apiKey, continueUrl, etc.)
  useEffect(() => {
    const mode = searchParams.get('mode')
    const code = searchParams.get('oobCode') || searchParams.get('code')

    if (DEV_DIAGNOSTICS) {
      console.log('[RESET_PASSWORD]', {
        hostname: window.location.hostname,
        hasMode: !!mode,
        hasOobCode: !!code,
      })
    }

    if (code && mode === 'resetPassword') {
      setOobCode(code)
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
    } catch (err: unknown) {
      let message = 'This reset link is invalid or has expired.'
      const codeErr = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
      if (codeErr === 'auth/expired-action-code' || codeErr === 'auth/invalid-action-code') {
        message = 'This reset link is invalid or has expired.'
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

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
    } catch (err: unknown) {
      let message = 'Failed to reset password. Please try again.'
      const codeErr = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
      if (codeErr === 'auth/expired-action-code' || codeErr === 'auth/invalid-action-code') {
        message = 'This reset link is invalid or has expired.'
      } else if (codeErr === 'auth/weak-password') {
        message = 'Password does not meet security requirements.'
      } else if (codeErr === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.'
      }
      setError(message)
    } finally {
      setVerifying(false)
    }
  }

  const passwordCriteria = validatePassword(password)
  const allMet = allCriteriaMet(passwordCriteria)
  const passwordsMatch = password === confirmPassword || confirmPassword === ''
  const isInvalidLink = !loading && !!error && !email

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'linear-gradient(135deg, #0a0a0c 0%, #1a0a0f 100%)' }}>
      <div className="w-full max-w-[520px] neon-glass p-8 md:p-10 rounded-2xl border border-[#ff0a45]/20 shadow-[0_0_40px_rgba(255,10,69,0.15)]">
        {/* Header */}
        <div className="mb-8 space-y-2 text-center">
          <Link 
            to="/" 
            className="inline-block text-xs font-bold uppercase tracking-[0.3em] mb-3 transition-colors"
            style={{ 
              color: '#ff0a45',
              textShadow: '0 0 12px rgba(255,10,69,0.6)'
            }}
          >
            DealFlowOS
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            {loading ? 'Verifying reset link' : isInvalidLink ? 'Invalid reset link' : success ? 'Password updated' : 'Reset your password'}
          </h1>
          <p className="text-sm text-white/60">
            {loading 
              ? 'Please wait while we verify your password reset link.' 
              : isInvalidLink 
                ? 'This link is no longer valid' 
                : success 
                  ? 'Your password has been updated successfully.' 
                  : 'Create a new password for your account.'}
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/10 border-t-[#ff0a45]"></div>
          </div>
        )}

        {/* Invalid Link State */}
        {!loading && isInvalidLink && (
          <div className="space-y-6">
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to="/forgot-password"
                className="w-full text-center px-4 py-3 rounded-lg bg-[#ff0a45] text-white font-semibold hover:bg-[#ff0a45]/90 transition-all shadow-[0_0_20px_rgba(255,10,69,0.3)] hover:shadow-[0_0_30px_rgba(255,10,69,0.5)]"
              >
                Request a new reset link
              </Link>
              <Link
                to="/login"
                className="w-full text-center px-4 py-3 rounded-lg border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        )}

        {/* Success State */}
        {!loading && success && (
          <div className="space-y-6">
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-6 text-center">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-sm text-green-400">
                Your password has been updated successfully.
              </p>
            </div>
            <Link
              to="/login"
              className="block w-full text-center px-4 py-3 rounded-lg bg-[#ff0a45] text-white font-semibold hover:bg-[#ff0a45]/90 transition-all shadow-[0_0_20px_rgba(255,10,69,0.3)] hover:shadow-[0_0_30px_rgba(255,10,69,0.5)]"
            >
              Return to sign in
            </Link>
          </div>
        )}

        {/* Reset Password Form */}
        {!loading && !isInvalidLink && !success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password Field */}
            <div>
              <label className="block text-left mb-2">
                <span className="text-sm text-white/80 font-medium">New password</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={verifying}
                  className="w-full rounded-lg bg-black/20 border border-white/10 px-4 py-3 pr-11 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60 focus:border-[#ff0a45]/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
            </div>

            {/* Password Requirements Checklist */}
            <div className="rounded-lg bg-black/30 border border-white/10 p-4">
              <p className="text-xs font-semibold text-white/70 mb-3 uppercase tracking-wider">Security requirements</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                    passwordCriteria.minLength 
                      ? 'bg-[#ff0a45]/20 border-[#ff0a45] text-[#ff0a45]' 
                      : 'border-white/20 text-white/30'
                  }`}>
                    {passwordCriteria.minLength ? '✓' : ''}
                  </span>
                  <span className={passwordCriteria.minLength ? 'text-white/80' : 'text-white/50'}>
                    Minimum 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                    passwordCriteria.hasUppercase 
                      ? 'bg-[#ff0a45]/20 border-[#ff0a45] text-[#ff0a45]' 
                      : 'border-white/20 text-white/30'
                  }`}>
                    {passwordCriteria.hasUppercase ? '✓' : ''}
                  </span>
                  <span className={passwordCriteria.hasUppercase ? 'text-white/80' : 'text-white/50'}>
                    At least 1 uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                    passwordCriteria.hasLowercase 
                      ? 'bg-[#ff0a45]/20 border-[#ff0a45] text-[#ff0a45]' 
                      : 'border-white/20 text-white/30'
                  }`}>
                    {passwordCriteria.hasLowercase ? '✓' : ''}
                  </span>
                  <span className={passwordCriteria.hasLowercase ? 'text-white/80' : 'text-white/50'}>
                    At least 1 lowercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                    passwordCriteria.hasNumber 
                      ? 'bg-[#ff0a45]/20 border-[#ff0a45] text-[#ff0a45]' 
                      : 'border-white/20 text-white/30'
                  }`}>
                    {passwordCriteria.hasNumber ? '✓' : ''}
                  </span>
                  <span className={passwordCriteria.hasNumber ? 'text-white/80' : 'text-white/50'}>
                    At least 1 number
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                    passwordCriteria.hasSpecial 
                      ? 'bg-[#ff0a45]/20 border-[#ff0a45] text-[#ff0a45]' 
                      : 'border-white/20 text-white/30'
                  }`}>
                    {passwordCriteria.hasSpecial ? '✓' : ''}
                  </span>
                  <span className={passwordCriteria.hasSpecial ? 'text-white/80' : 'text-white/50'}>
                    At least 1 special character (!@#$%^&*)
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-left mb-2">
                <span className="text-sm text-white/80 font-medium">Confirm new password</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={verifying}
                  className="w-full rounded-lg bg-black/20 border border-white/10 px-4 py-3 pr-11 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60 focus:border-[#ff0a45]/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
                <p className="text-xs text-red-400 mt-2">Passwords do not match.</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-sm text-red-400 text-center">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={verifying || !allMet || !passwordsMatch || !password || !confirmPassword}
              className="w-full rounded-lg bg-[#ff0a45] px-4 py-3 text-sm font-semibold text-white hover:bg-[#ff0a45]/90 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,10,69,0.3)] hover:shadow-[0_0_30px_rgba(255,10,69,0.5)] disabled:shadow-none"
            >
              {verifying ? 'Updating password...' : 'Set new password'}
            </button>

            {/* Back to Sign In Link */}
            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-sm text-white/60 hover:text-white/80 transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

