import { X } from 'lucide-react'

interface DocumentModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  content: string
}

export function DocumentModal({ isOpen, onClose, title, content }: DocumentModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-2xl bg-black/80 backdrop-blur-xl border border-[#ff1e1e]/40 p-6 w-full max-w-md shadow-[0_0_35px_#ff1e1e33]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-[#ff1e1e] transition-colors rounded-lg p-1 hover:bg-white/5"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">{content}</p>
          
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-[#ff1e1e]/30 bg-[#ff1e1e]/10 px-4 py-2 text-sm font-medium text-white hover:bg-[#ff1e1e]/20 hover:border-[#ff1e1e]/40 hover:shadow-[0_0_15px_#ff1e1e33] transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
