import { ReactNode } from 'react'

export default function ResourceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dashboard-card p-5 flex flex-col gap-3 min-h-[200px] max-w-full break-words">
      <h2 className="text-zinc-300 text-xs tracking-wider uppercase font-medium">{title}</h2>
      <div className="text-zinc-400 space-y-1.5 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}
