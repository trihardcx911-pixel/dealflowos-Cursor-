import { Plus } from 'lucide-react'

interface UploadFloatingButtonProps {
  onClick: () => void
}

export function UploadFloatingButton({ onClick }: UploadFloatingButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-10 right-8 w-14 h-14 rounded-full bg-[#0d0d0d] border-2 border-[#ff0a45] shadow-[0_0_15px_#ff0a45] flex items-center justify-center cursor-pointer hover:shadow-[0_0_25px_#ff0a45] transition z-50"
      aria-label="Upload document"
    >
      <Plus className="w-6 h-6 text-[#ff0a45]" />
    </button>
  )
}

