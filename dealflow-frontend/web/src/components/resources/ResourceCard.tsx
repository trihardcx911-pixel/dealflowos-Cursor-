import { ReactNode } from 'react'

export default function ResourceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dashboard-card p-6 flex flex-col gap-4 min-h-[220px] max-w-full break-words">
      <h2 className="text-zinc-300 text-sm tracking-wide uppercase">{title}</h2>
      <div className="text-zinc-400 space-y-2 text-base leading-relaxed">
        {children}
      </div>
    </div>
  );
}
