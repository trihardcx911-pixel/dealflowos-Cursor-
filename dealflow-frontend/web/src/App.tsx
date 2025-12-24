import { Outlet, useLocation } from 'react-router-dom'
import { AppHeader } from './components/layout/AppHeader'
import { SidebarNav } from './components/layout/SidebarNav'

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Leads', to: '/leads' },
  { label: 'Calendar', to: '/calendar' },
  { label: 'Tasks', to: '/tasks' },
  { label: 'Legal Docs', to: '/legal-documents' },
  { label: 'Settings', to: '/settings' },
  { label: 'Profile', to: '/me' },
]

export default function App() {
  const location = useLocation()
  const isFullWidthPage = location.pathname === '/' || location.pathname.startsWith('/kpis')

  return (
    <div 
      className="min-h-screen text-white"
      style={{
        background: `
          radial-gradient(circle at top left, #1a001a 0%, #06000d 40%, #000 80%),
          radial-gradient(circle, rgba(255,0,80,0.05) 1px, transparent 1px),
          radial-gradient(circle, rgba(255,0,80,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 1200px 1200px, 600px 600px',
        backgroundPosition: '0 0, 0 0, 0 0',
      }}
    >
      <div className="relative isolate">
        <AppHeader />
        {isFullWidthPage ? (
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="neon-glass w-full max-w-xs p-6 text-sm">
              <SidebarNav items={navItems} />
            </div>
            <main className="flex-1">
              <Outlet />
            </main>
          </div>
        ) : (
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:flex-row">
            <div className="neon-glass w-full max-w-xs p-6 text-sm">
              <SidebarNav items={navItems} />
            </div>
            <main className="neon-glass flex-1 p-6 md:p-8">
              <Outlet />
            </main>
          </div>
        )}
      </div>
    </div>
  )
}
