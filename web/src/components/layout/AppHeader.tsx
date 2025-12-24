import { Link } from 'react-router-dom'

export function AppHeader() {
  return (
    <header className="neon-glass border-b border-[#ff0a45]/20 mb-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-lg font-semibold text-white hover:text-[#ff0a45] transition-colors">
          Wholesale CRM
        </Link>
        <div className="text-sm text-white/60">
          <span className="hidden sm:inline">UI preview ·</span> Built with Vite + Tailwind
        </div>
      </div>
    </header>
  )
}
