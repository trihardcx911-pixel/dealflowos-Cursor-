import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AuthLayoutProps = {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div 
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(30, 30, 40, 1) 0%, rgba(15, 15, 22, 1) 100%)',
      }}
    >
      <div 
        className="w-full max-w-md space-y-6 rounded-[14px] p-8 relative"
        style={{
          background: 'rgba(18, 18, 28, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 0, 51, 0.15)',
          boxShadow: '0 0 30px rgba(255, 0, 51, 0.1), inset 0 0 40px rgba(255, 255, 255, 0.02)',
        }}
      >
        <div 
          className="absolute inset-0 rounded-[14px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top left, rgba(255, 0, 51, 0.08), transparent 60%)',
          }}
        />
        <div className="space-y-1 text-center relative z-10">
          <Link to="/" className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--neon-red)] hover:text-[var(--neon-red)] transition-colors" style={{ textShadow: '0 0 8px rgba(255, 0, 51, 0.4)' }}>
            DealFlowOS
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-white/95">{title}</h1>
          {subtitle && <p className="text-sm text-white/75">{subtitle}</p>}
        </div>
        <div className="relative z-10">{children}</div>
        {footer && <div className="text-center text-sm text-white/70 relative z-10">{footer}</div>}
      </div>
    </div>
  )
}
