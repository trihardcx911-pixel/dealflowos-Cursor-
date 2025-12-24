import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-sm uppercase tracking-widest text-neutral-400">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Page not found</h1>
      <p className="mt-2 text-neutral-400">The view you requested does not exist.</p>
      <Link to="/" className="mt-6 rounded-xl bg-[#ff0a45] px-6 py-3 text-sm font-semibold text-white hover:bg-[#ff0a45]/90 shadow-[0_0_10px_#ff0a45] transition-all">
        Back to dashboard
      </Link>
    </div>
  )
}
