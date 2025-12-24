import { createContext, useContext, useMemo, useState } from 'react'

type Toast = { id: number; kind: 'success' | 'error'; message: string }
type Ctx = { notify: (kind: Toast['kind'], message: string) => void }

const ToastCtx = createContext<Ctx | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const notify = (kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs, { id, kind, message }])
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 3000)
  }
  const value = useMemo(() => ({ notify }), [])
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {items.map(t => (
          <div key={t.id} className={`px-3 py-2 rounded shadow text-white ${t.kind === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
