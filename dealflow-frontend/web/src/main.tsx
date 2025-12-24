import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import './styles/neon.css'
import App from './App'
import ProtectedRoute from './ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import LeadsPage from './pages/LeadsPage'
import CalendarPage from './pages/CalendarPage'
import TasksPage from './pages/TasksPage'
import LegalDocumentsPage from './pages/LegalDocumentsPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import KpisPage from './pages/KpisPage'
import ResourcesPage from './pages/ResourcesPage'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import NotFoundPage from './pages/NotFoundPage'
import { ToastProvider } from './useToast'

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'leads', element: <LeadsPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'legal-documents', element: <LegalDocumentsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'me', element: <ProfilePage /> },
          { path: 'kpis', element: <KpisPage /> },
          { path: 'resources', element: <ResourcesPage /> },
        ],
      },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '*', element: <NotFoundPage /> },
])

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root container missing in index.html')
}

createRoot(container).render(
  <React.StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </React.StrictMode>
)
