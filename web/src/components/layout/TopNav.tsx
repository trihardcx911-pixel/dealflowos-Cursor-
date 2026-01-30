import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

type NavItem = { label: string; to: string }

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Leads', to: '/leads' },
  { label: 'Calendar', to: '/calendar' },
  { label: 'Tasks', to: '/tasks' },
  { label: 'KPIs', to: '/kpis' },
  { label: 'Settings', to: '/settings' },
]

interface TopNavProps {
  className?: string;
}

export function TopNav({ className = '' }: TopNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <>
      <nav className={`sticky top-0 z-50 w-full backdrop-blur-xl bg-black/30 border-b border-[#ff0a45]/25 shadow-[0_0_20px_rgba(255,0,80,0.35)] transition-all duration-300 ease-out ${className}`}>
        <div className="flex items-center justify-between h-16 px-6 md:px-8">
          {/* Logo/Brand */}
          <NavLink
            to="/"
            className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 hover:text-[#ff0a45] transition-colors"
          >
            DealflowOS
          </NavLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to || 
                (item.to !== '/' && location.pathname.startsWith(item.to))
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={`
                    relative px-2 py-1 font-medium tracking-wide transition-all
                    ${isActive 
                      ? 'text-[#ff0a45] font-semibold shadow-[0_0_10px_#ff0a45]' 
                      : 'text-neutral-800 dark:text-neutral-100 hover:text-[#ff0a45]'
                    }
                  `}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff0a45] shadow-[0_0_4px_#ff0a45]" />
                  )}
                </NavLink>
              )
            })}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-neutral-800 dark:text-neutral-100 hover:text-[#ff0a45] transition-colors p-2"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu Panel */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-black/40 backdrop-blur-2xl border-b border-[#ff0a45]/30 transition-all duration-300 ease-out overflow-hidden">
            <div className="px-6 py-4 space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to || 
                  (item.to !== '/' && location.pathname.startsWith(item.to))
                
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      block px-4 py-3 rounded-lg font-medium tracking-wide transition-all
                      ${isActive
                        ? 'text-[#ff0a45] font-semibold bg-[#ff0a45]/10 border border-[#ff0a45]/30 shadow-[0_0_10px_#ff0a45]'
                        : 'text-neutral-800 dark:text-neutral-100 hover:text-[#ff0a45] hover:bg-white/5'
                      }
                    `}
                  >
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          </div>
        )}
      </nav>
    </>
  )
}

