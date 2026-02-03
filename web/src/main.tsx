import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { initTheme } from './hooks/useTheme'
import { initAccessibility } from './hooks/useAccessibility'
import './index.css'
import App from './App'
import ProtectedRoute from './ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import LeadsPage from './pages/LeadsPage'
import CalendarPage from './pages/CalendarPage'
import TasksPage from './pages/TasksPage'
import SettingsPage from './pages/SettingsPage'
import BillingPage from './pages/BillingPage'
import BillingHistoryPage from './pages/BillingHistoryPage'
import KpisPage from './pages/KpisPage'
import ResourcesPage from './pages/ResourcesPage'
import DealPage from './pages/DealPage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import LandingPage from './components/LandingPage'
import PricingPage from './pages/PricingPage'
import TermsOfService from './pages/TermsOfService'
import NotFoundPage from './pages/NotFoundPage'
import BillingRedirectPage from './pages/billing/BillingRedirectPage'
import BillingSuccessPage from './pages/billing/BillingSuccessPage'
import BillingCancelPage from './pages/billing/BillingCancelPage'
import OnboardingPlanPage from './pages/onboarding/OnboardingPlanPage'
import { ToastProvider } from './useToast'
import { completeEmailLinkSignIn } from './auth/firebaseAuth'
import { establishAppSession } from './lib/firebase/auth'

// One-time cleanup: remove any stale mock token from storage
const storedToken = localStorage.getItem('token')
if (typeof storedToken === 'string' && storedToken.startsWith('mock-jwt-token')) {
  localStorage.removeItem('token')
}

// Build stamp for deploy verification (proves which bundle is running)
console.log('[BUILD_STAMP]', import.meta.env.MODE, import.meta.env.PROD, import.meta.env.VITE_BUILD_STAMP ?? '__STAMP__')
console.log('[BUILD]', import.meta.env.MODE, import.meta.env.VITE_GIT_SHA ?? 'no-sha', new Date().toISOString())

// 🆕 React Query imports
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// 🆕 Create global QueryClient instance
const queryClient = new QueryClient();

// Complete email link sign-in if link is detected; exchange Firebase user for app JWT
completeEmailLinkSignIn()
  .then(async (user) => {
    if (user) await establishAppSession(user)
  })
  .catch((err) => {
    console.error('Email link sign-in completion error:', err)
  })

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/pricing', element: <PricingPage /> },
  { path: '/terms', element: <TermsOfService /> },
  {
    element: <App />,
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'leads', element: <LeadsPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/billing', element: <BillingPage /> },
          { path: 'settings/billing-history', element: <BillingHistoryPage /> },
          { path: 'kpis', element: <KpisPage /> },
          { path: 'resources', element: <ResourcesPage /> },
          { path: 'deals/:dealId', element: <DealPage /> },
        ],
      },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/billing/redirect', element: <BillingRedirectPage /> },
  { path: '/billing/success', element: <BillingSuccessPage /> },
  { path: '/billing/cancel', element: <BillingCancelPage /> },
  { path: '/onboarding/plan', element: <OnboardingPlanPage /> },
  { path: '*', element: <NotFoundPage /> },
])

// Initialize theme and accessibility before React render to prevent flash
initTheme()
initAccessibility()

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root container missing in index.html')
}

createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
