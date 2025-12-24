import { NavLink } from 'react-router-dom'
import { useLanguage } from '../../i18n/i18n'

type NavItem = { label: string; to: string }

type SidebarNavProps = {
  items: NavItem[]
}

export function SidebarNav({ items }: SidebarNavProps) {
  const lang = useLanguage()

  return (
    <nav className="relative z-10 w-full text-sm text-white">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.to} className="relative z-10">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                [
                  'relative z-10 flex items-center gap-3 px-4 py-3 font-semibold transition-all rounded-lg',
                  'neon-nav-item',
                  isActive
                    ? 'active-nav text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5',
                ].join(' ')
              }
              end={item.to === '/'}
            >
              {({ isActive }) => (
                <>
                  <span className="tracking-wide whitespace-nowrap flex-1">{item.label}</span>
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full transition-all flex-shrink-0"
                    style={{
                      background: isActive ? 'var(--neon-red)' : 'rgba(255,255,255,0.25)',
                      boxShadow: isActive ? '0 0 4px rgba(255,0,80,0.4)' : 'none',
                    }}
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
