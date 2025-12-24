import { useRef, useState, useCallback } from 'react'
import { Upload, X } from 'lucide-react'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload?: (files: File[]) => void
}

export function UploadModal({ isOpen, onClose, onUpload }: UploadModalProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const acceptedTypes = ['.pdf', '.docx', '.txt']
  const acceptedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files).filter((file) => {
        const extension = '.' + file.name.split('.').pop()?.toLowerCase()
        return acceptedTypes.includes(extension) || acceptedMimeTypes.includes(file.type)
      })

      if (files.length > 0 && onUpload) {
        onUpload(files)
      }
    },
    [onUpload]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((file) => {
        const extension = '.' + file.name.split('.').pop()?.toLowerCase()
        return acceptedTypes.includes(extension) || acceptedMimeTypes.includes(file.type)
      })

      if (files.length > 0 && onUpload) {
        onUpload(files)
      }
    },
    [onUpload]
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 w-[80%] max-w-2xl h-[260px] rounded-2xl bg-[#0f0f14]/70 backdrop-blur-xl border border-[#ff0a45]/30 shadow-[0_0_20px_#ff0a45] flex flex-col p-6 z-50 relative overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 text-neutral-400 hover:text-[#ff0a45] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Upload icon */}
        <Upload className="w-10 h-10 text-[#ff0a45] mb-3 mx-auto" />

        {/* Title */}
        <h3 className="text-xl font-semibold tracking-wide text-white mb-2 text-center">
          Upload Legal Documents
        </h3>

        {/* Subtext */}
        <p className="text-sm opacity-70 text-neutral-300 mb-4 text-center">
          Drag and drop files here or click to browse
        </p>

        {/* DropZone - only one */}
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full flex-1 border-2 border-dashed border-[#ff0a45]/50 rounded-xl flex items-center justify-center transition cursor-pointer hover:border-[#ff0a45] hover:shadow-[0_0_15px_#ff0a45] ${
            isDragging ? 'bg-[#ff0a45]/10' : 'bg-transparent'
          }`}
        >
          <p className="text-sm opacity-70">Click or drag files here</p>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
    </>
  )
}
