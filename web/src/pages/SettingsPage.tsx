import React, { useState, useEffect } from 'react'
import { t as translate, setLanguage, getLanguage } from "../i18n/i18n";

import BackToDashboard from '../components/BackToDashboard'
import { SettingsUsage } from '../components/SettingsUsage'
import { AccountPanel } from '../components/AccountPanel'
import { get } from '../api'
import { Edit2 } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useAccessibility } from '../hooks/useAccessibility'

interface UserData {
  name?: string;
  email?: string;
  phone?: string;
  userId?: string;
  orgId?: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState({ organization: 'Wholesale CRM', timezone: 'America/Chicago' })
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { fontMode, setDyslexic, isDyslexic } = useAccessibility()

  function update<K extends keyof typeof profile>(key: K, value: string) {
    setProfile({ ...profile, [key]: value })
  }

  // Fetch user data from /me endpoint
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true)
        const data = await get<UserData>('/me')
        setUserData(data)
        setError(null)
      } catch (e: any) {
        setError(e?.error?.message || e?.message || 'Unable to load profile')
        setUserData(null)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  // Re-render on language change
  useEffect(() => {
    const rerender = () => setProfile({ ...profile });
    window.addEventListener("language-change", rerender);
    return () => window.removeEventListener("language-change", rerender);
  }, [])

  const handleAccountSave = async (data: {
    name: string;
    email: string;
    phone: string;
    password?: string;
  }) => {
    // TODO: Implement PUT /me endpoint call
    console.log('Saving account data:', data)
    // For now, just update local state
    setUserData({
      ...userData,
      name: data.name,
      email: data.email,
      phone: data.phone,
    })
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
              onClick={() => setIsAccountPanelOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#ff0a45]/40 bg-[#ff0a45]/10 text-[#ff0a45] hover:bg-[#ff0a45]/20 hover:shadow-[0_0_8px_rgba(255,10,69,0.5)] transition-all text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit Account
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-neutral-400">Loading...</div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-2">{error}</p>
              <p className="text-sm text-neutral-500">No profile data found</p>
            </div>
          ) : userData ? (
            <div className="space-y-4">
              {/* Avatar and Name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#ff0a45]/20 border-2 border-[#ff0a45]/40 flex items-center justify-center text-[#ff0a45] font-bold text-xl shadow-[0_0_12px_rgba(255,10,69,0.4)]">
                  {getInitials(userData.name, userData.email)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {userData.name || 'No name set'}
                  </h3>
                  {userData.email && (
                    <p className="text-sm text-neutral-400">{userData.email}</p>
                  )}
                </div>
              </div>

              {/* Account Details */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Email</span>
                  <span className="text-sm text-white font-medium">
                    {userData.email || 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Phone</span>
                  <span className="text-sm text-white font-medium">
                    {userData.phone || 'Not set'}
                  </span>
                </div>
                {userData.userId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">User ID</span>
                    <span className="text-sm text-neutral-500 font-mono">
                      {userData.userId}
                    </span>
                  </div>
                )}
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

          {/* Accessibility Section */}
          <div className="rounded-[24px] bg-[#0a0a0c]/60 border border-[#ff0a45]/20 p-6 mb-6">
            <h2 className="text-xl font-semibold text-white">Accessibility</h2>
            <p className="text-sm text-neutral-400 mt-1">Customize font settings for better readability</p>

            <div className="mt-4">
              <button
                onClick={() => setDyslexic(isDyslexic ? 'normal' : 'dyslexic')}
                className={`w-full px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                  isDyslexic
                    ? 'bg-[#ff0a45]/20 border-[#ff0a45]/40 text-[#ff0a45] shadow-[0_0_8px_rgba(255,10,69,0.5)]'
                    : 'bg-black/30 border-white/10 text-white hover:border-[#ff0a45]/40'
                }`}
              >
                {isDyslexic ? '✓ Use Dyslexia-Friendly Font' : 'Use Dyslexia-Friendly Font'}
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
          phone: userData?.phone,
        }}
      />
    </div>
  )
}
