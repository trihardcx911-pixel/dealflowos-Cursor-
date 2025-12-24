import { NeonCard } from './NeonCard'

export function LegalDocsCard() {
  const documents = [
    { name: 'Purchase Agreement Template', status: 'active' },
    { name: 'Assignment Contract', status: 'active' },
    { name: 'Disclosure Forms', status: 'draft' },
  ]

  return (
    <NeonCard
      sectionLabel="DOCUMENTS"
      title="Legal Documents"
      colSpan={4}
    >
      <div className="space-y-3 flex-1">
        {documents.map((doc, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-sm flex-1 truncate text-white">{doc.name}</span>
            <span
              className={`text-xs text-white/60 uppercase tracking-[0.2em] px-2 py-1 rounded ${
                doc.status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {doc.status}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <button className="text-xs text-white/60 uppercase tracking-[0.25em] hover:text-white transition-colors">
          Manage Documents →
        </button>
      </div>
    </NeonCard>
  )
}
