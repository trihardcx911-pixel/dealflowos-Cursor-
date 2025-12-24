import { LucideIcon } from 'lucide-react'

interface DocumentCategoryCardProps {
  icon: LucideIcon
  title: string
  description: string
  count?: number
  onViewAll?: () => void
  onUpload?: () => void
}

export function DocumentCategoryCard({
  icon: Icon,
  title,
  description,
  count = 0,
  onViewAll,
  onUpload,
}: DocumentCategoryCardProps) {
  return (
    <div className="flex flex-col justify-between h-full space-y-3 rounded-2xl bg-[#0a0a0d]/80 backdrop-blur-xl border border-[#ff0a45]/20 hover:border-[#ff0a45] hover:shadow-[0_0_12px_#ff0a45] p-6 min-h-[360px] transition-all">
      {/* Icon */}
      <div className="pt-2">
        <div className="w-12 h-12 rounded-xl bg-[#ff0a45]/10 border border-[#ff0a45]/30 flex items-center justify-center">
          <Icon className="w-6 h-6 text-[#ff0a45]" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[1.1rem] font-semibold tracking-wide text-white mt-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm opacity-70 leading-relaxed text-neutral-300 mt-1">
        {description}
      </p>

      {/* Spacer to push buttons to bottom when using justify-between */}
      <div className="flex-1" />

      {/* Buttons */}
      <div className="mt-3 flex gap-3">
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#ff0a45]/30 bg-[#ff0a45]/5 text-[#ff0a45] hover:bg-[#ff0a45]/10 hover:border-[#ff0a45]/50 hover:shadow-[0_0_10px_#ff0a45] transition-all duration-300 text-sm font-medium"
          >
            View All
          </button>
        )}
        {onUpload && (
          <button
            onClick={onUpload}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_10px_#ff0a45] hover:shadow-[0_0_15px_#ff0a45] transition-all duration-300 text-sm font-medium"
          >
            Upload
          </button>
        )}
      </div>
    </div>
  )
}
