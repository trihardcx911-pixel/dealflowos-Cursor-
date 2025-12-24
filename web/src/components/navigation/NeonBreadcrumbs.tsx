import { useNavigate } from "react-router-dom"

interface NeonBreadcrumbsProps {
  items: { label: string; to?: string }[]
}

export function NeonBreadcrumbs({ items }: NeonBreadcrumbsProps) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center text-sm mb-6">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <div key={idx} className="flex items-center">
            {!isLast ? (
              <button
                onClick={() => item.to && navigate(item.to)}
                className="text-white/60 hover:text-white transition-colors underline-offset-4 hover:underline"
              >
                {item.label}
              </button>
            ) : (
              <span className="text-white font-medium">{item.label}</span>
            )}
            {!isLast && (
              <span className="mx-2 text-red-500/80 select-none">›</span>
            )}
          </div>
        )
      })}
    </div>
  )
}










