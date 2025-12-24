import { useEffect, useState } from 'react'
import { NeonCard } from './NeonCard'

type CreditsCardProps = {
  credits: number
  label?: string
}

export function CreditsCard({ credits, label = 'AI Credits' }: CreditsCardProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(true), 120)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <NeonCard
      sectionLabel={label.toUpperCase()}
      title="AI Credits Left"
      colSpan={4}
    >
      <div className="flex-1 flex flex-col justify-center mt-1">
        <p
          className="text-5xl font-bold text-[#ff0a45] transition-opacity duration-500"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {credits.toLocaleString()}
        </p>
        <p className="text-sm text-white/60 mt-6">refreshing nightly</p>
      </div>
    </NeonCard>
  )
}
