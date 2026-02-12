import React, { useState, useEffect } from 'react'
import { t as translate, setLanguage, getLanguage } from "../i18n/i18n";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom'

import BackToDashboard from '../components/BackToDashboard'
import { SettingsUsage } from '../components/SettingsUsage'
import { AccountPanel } from '../components/AccountPanel'
import { get, patch } from '../api'
import { Edit2, LogOut } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useAccessibility } from '../hooks/useAccessibility'
import { logout as firebaseLogout } from '../auth/firebaseAuth'

// API response type for /api/user/me
type ApiUserMe = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  activeOrgId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

// Legacy UserData type (for AccountPanel compatibility)
interface UserData {
  name?: string;
  email?: string;
  phone?: string;
  userId?: string;
  orgId?: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState({ organization: 'Wholesale CRM', timezone: 'America/Chicago' })
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { fontMode, setDyslexic, isDyslexic } = useAccessibility()

  function update<K extends keyof typeof profile>(key: K, value: string) {
    setProfile({ ...profile, [key]: value })
  }

  // Fetch user profile from /api/user/me using React Query
  const { data: apiResponse, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => get<{ ok: boolean; user: ApiUserMe }>('/user/me'),
  });

  // Derive user data from API response
  const user = apiResponse?.ok ? apiResponse.user : null;
  
  // Map API fields to UI-friendly values
  const displayName = user?.displayName ?? '';
  const email = user?.email ?? '';

  // Legacy UserData object for AccountPanel compatibility (read-only mapping)
  const userData: UserData | null = user ? {
    name: user.displayName || undefined,
    email: user.email || undefined,
    phone: undefined, // Phone not supported yet
    userId: user.id,
    orgId: user.activeOrgId || undefined,
  } : null;

  // Extract error message for UI
  const error = isError ? (queryError as any)?.error?.message || (queryError as any)?.message || 'Unable to load profile' : null;

  // Re-render on language change
  useEffect(() => {
    const rerender = () => setProfile({ ...profile });
    window.addEventListener("language-change", rerender);
    return () => window.removeEventListener("language-change", rerender);
  }, [])

  const handleAccountSave = async (data: {
    name: string;
  }) => {
    try {
      setSaveError(null)

      // Build payload with ONLY supported fields (displayName)
      // Do NOT send email, phone, or password - backend will reject them
      const payload: { displayName?: string | null } = {
        displayName: data.name?.trim() || null,
      }

      // Call PATCH /api/user/me
      await patch<{ ok: boolean; user: ApiUserMe }>('/user/me', payload)

      // On success: invalidate React Query cache to refresh UI
      await queryClient.invalidateQueries({ queryKey: ['user-me'] })

      // Close modal
      setIsAccountPanelOpen(false)
    } catch (error: any) {
      // Extract backend error message
      // ApiError from api.ts throws with: { status, message, body }
      // Backend returns: { ok: false, code: "...", error: "..." }
      const errorMessage = 
        error?.body?.error ||  // Backend error message
        error?.message ||      // ApiError.message (which extracts data?.error)
        'Failed to update profile'
      
      setSaveError(errorMessage)
      
      // Log error for debugging (but don't expose stack traces to user)
      console.error('[USER PROFILE] Save error:', errorMessage)
    }
  }

  // Get user initials for avatar
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  const handleLogout = async () => {
    try {
      // Sign out from Firebase (if in use)
      await firebaseLogout()
    } catch (err) {
      // Non-fatal: still clear local session below
      console.error('[LOGOUT_ERROR]', err)
    }

    // Clear auth token
    localStorage.removeItem('token')
    
    // Clear dev identity override
    localStorage.removeItem('DFOS_FORCE_DEV_IDENTITY')
    
    // Clear dev headers (optional, but safe)
    localStorage.removeItem('DFOS_DEV_ORG_ID')
    localStorage.removeItem('DFOS_DEV_USER_ID')
    
    // Clear React Query cache
    queryClient.clear()
    
    // Redirect to login page to avoid public header flash
    navigate('/login', { replace: true })
  }


  return (
    <div className="w-full">
      <BackToDashboard />
      
      {/* Header */}
      <div className="mb-8">
        <p className="text-[0.7rem] tracking-[0.35em] uppercase text-neutral-400">
          Configuration
        </p>
        <div className="mt-2">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-neutral-400 max-w-xl">
            Manage your account information and workspace settings.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        {/* Account Information Section */}
        <div className="rounded-[32px] bg-[#0a0a0c]/60 border border-[#ff0a45]/25 backdrop-blur-xl shadow-[0_0_40px_rgba(255,10,69,0.18)] p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">{translate("settings.account")}</h2>
            <button
              onClick={() => {
                setSaveError(null)
                setIsAccountPanelOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#ff0a45]/40 bg-[#ff0a45]/10 text-[#ff0a45] hover:bg-[#ff0a45]/20 hover:shadow-[0_0_8px_rgba(255,10,69,0.5)] transition-all text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit Account
            </button>
          </div>

          {saveError && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/40 text-red-400 text-sm">
              {saveError}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-neutral-400">Loading...</div>
          ) : isError || error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-2">{error}</p>
              <p className="text-sm text-neutral-500">Unable to load profile data</p>
            </div>
          ) : user ? (
            <div className="space-y-4">
              {/* Avatar and Name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#ff0a45]/20 border-2 border-[#ff0a45]/40 flex items-center justify-center text-[#ff0a45] font-bold text-xl shadow-[0_0_12px_rgba(255,10,69,0.4)]">
                  {getInitials(displayName, email)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {displayName || 'No name set'}
                  </h3>
                  {email && (
                    <p className="text-sm text-neutral-400">{email}</p>
                  )}
                </div>
              </div>

              {/* Account Details */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Email</span>
                  <span className="text-sm text-white font-medium">
                    {email || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Phone</span>
                  <span className="text-sm text-white font-medium">
                    —
                  </span>
                </div>
                {user?.id && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">User ID</span>
                    <span className="text-sm text-neutral-500 font-mono">
                      {user.id}
                    </span>
                  </div>
                )}
              </div>

              {/* Log out button */}
              <div className="pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full h-10 px-4 rounded-xl neon-glass border border-[#ff0a45]/30 text-[#ff0a45] hover:bg-white/5 hover:border-[#ff0a45]/50 hover:shadow-[0_0_8px_rgba(255,10,69,0.3)] transition-all flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500">
              No profile data found
            </div>
          )}
        </div>

        {/* Settings Form */}
        <div className="rounded-[32px] bg-[#0a0a0c]/60 border border-[#ff0a45]/25 backdrop-blur-xl shadow-[0_0_40px_rgba(255,10,69,0.18)] p-8">
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Organization
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-neutral-400 focus:border-[#ff0a45] focus:shadow-[0_0_10px_#ff0a45] focus:outline-none transition-all"
                  value={profile.organization}
                  onChange={(e) => update('organization', e.target.value)}
                  placeholder="Organization name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  {translate("settings.timezone")}
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-neutral-400 focus:border-[#ff0a45] focus:shadow-[0_0_10px_#ff0a45] focus:outline-none transition-all"
                  value={profile.timezone}
                  onChange={(e) => update('timezone', e.target.value)}
                  placeholder="America/Chicago"
                />
              </div>
              
              <button
                type="button"
                className="px-4 py-2 mt-4 rounded-xl bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_10px_#ff0a45] hover:shadow-[0_0_15px_#ff0a45] transition-all text-sm font-medium"
              >
                Save (local only)
              </button>
              
              <p className="text-xs text-neutral-500">TODO: Wire this form to the actual user settings API.</p>
            </form>
          </div>

          {/* Language Section */}
          <div className="rounded-[24px] bg-[#0a0a0c]/60 border border-[#ff0a45]/20 p-6 mb-6">
            <h2 className="text-xl font-semibold text-white">{translate("settings.language")}</h2>
            <p className="text-sm text-neutral-400 mt-1">{translate("settings.select_language")}</p>

            <select
  className="w-full mt-3 rounded-xl bg-black/40 border border-[#ff0a45]/40 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]"
  value={getLanguage()}
  onChange={(e) => setLanguage(e.target.value)}
>
  <option value="en">{translate("settings.english")}</option>
  <option value="es">{translate("settings.spanish")}</option>
  <option value="pt">{translate("settings.portuguese")}</option>
</select>

          </div>

          {/* Theme Section */}
          <div className="rounded-[24px] bg-[#0a0a0c]/60 border border-[#ff0a45]/20 p-6 mb-6">
            <h2 className="text-xl font-semibold text-white">Theme</h2>
            <p className="text-sm text-neutral-400 mt-1">Choose your preferred color scheme</p>

            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                  theme === 'light'
                    ? 'bg-[#ff0a45]/20 border-[#ff0a45]/40 text-[#ff0a45] shadow-[0_0_8px_rgba(255,10,69,0.5)]'
                    : 'bg-black/30 border-white/10 text-white hover:border-[#ff0a45]/40'
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                  theme === 'dark'
                    ? 'bg-[#ff0a45]/20 border-[#ff0a45]/40 text-[#ff0a45] shadow-[0_0_8px_rgba(255,10,69,0.5)]'
                    : 'bg-black/30 border-white/10 text-white hover:border-[#ff0a45]/40'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          {/* Usage & Billing Section */}
          <SettingsUsage />
      </div>

      {/* Account Panel Modal */}
      <AccountPanel
        isOpen={isAccountPanelOpen}
        onClose={() => setIsAccountPanelOpen(false)}
        onSave={handleAccountSave}
        initialData={{
          name: userData?.name,
          email: userData?.email,
        }}
      />
    </div>
  )
}
