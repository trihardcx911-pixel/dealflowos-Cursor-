import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-sm uppercase tracking-widest text-slate-400">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The view you requested does not exist.</p>
      <Link to="/" className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
        Back to dashboard
      </Link>
    </div>
  )
}
