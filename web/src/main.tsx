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
import LandingPage from './components/LandingPage'
import PricingPage from './pages/PricingPage'
import NotFoundPage from './pages/NotFoundPage'
import { ToastProvider } from './useToast'

// 🆕 React Query imports
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// 🆕 Create global QueryClient instance
const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/pricing', element: <PricingPage /> },
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
