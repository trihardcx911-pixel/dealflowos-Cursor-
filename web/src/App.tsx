import { t as translate, useLanguage } from "./i18n/i18n";
import { Outlet } from 'react-router-dom'

import { TopNav } from './components/layout/TopNav'
import { SidebarNav } from './components/layout/SidebarNav'

export default function App() {
  // forces rerender when language changes
  const lang = useLanguage();

  const navItems = [
    { label: translate("nav.dashboard"), to: "/dashboard" },
    { label: translate("nav.leads"), to: "/leads" },
    { label: translate("nav.calendar"), to: "/calendar" },
    { label: translate("nav.tasks"), to: "/tasks" },
    { label: translate("nav.settings"), to: "/settings" },
  ];

  return (
    <div 
      className="min-h-screen bg-[var(--bg-base)] flex flex-col text-white w-full"
    >
      <span style={{ display: "none" }}>{lang}</span>
      {/* TopNav: visible on < 1280px (xl breakpoint) */}
      <TopNav className="xl:hidden" />
      
      {/* Main layout container */}
      <div className="flex flex-row w-full max-w-[1600px] mx-auto px-6 md:px-12 flex-1">
        {/* SidebarNav: visible on ≥ 1280px (xl breakpoint) */}
        <aside className="hidden xl:flex flex-col w-[220px] flex-shrink-0 overflow-y-auto neon-glass-sidebar p-6 text-sm transition-all duration-300 ease-out">
          <SidebarNav items={navItems} />
        </aside>
        
        {/* Main content */}
        <main className="flex-1 w-full py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
