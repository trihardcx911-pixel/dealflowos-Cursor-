import { ReactNode } from 'react'

export default function ResourceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dashboard-card p-5 flex flex-col gap-3 min-h-[200px] max-w-full break-words">
      <h2 className="text-slate-700 dark:text-zinc-300 text-base font-semibold tracking-tight leading-snug font-display">{title}</h2>
      <div className="text-slate-600 dark:text-zinc-400 space-y-1.5 text-sm leading-relaxed tracking-normal font-sans">
        {children}
      </div>
    </div>
  );
}
