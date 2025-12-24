import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

type ProtectedRouteProps = {
  children?: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return children ? <>{children}</> : <Outlet />
}
