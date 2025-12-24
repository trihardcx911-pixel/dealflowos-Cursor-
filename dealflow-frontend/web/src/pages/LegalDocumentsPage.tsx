import { useState } from 'react'
import { FileText, ClipboardList, FileSignature } from 'lucide-react'
import { DocumentCategoryCard } from '../components/legal/DocumentCategoryCard'
import { UploadFloatingButton } from '../components/legal/UploadFloatingButton'
import { UploadModal } from '../components/legal/UploadModal'
import BackToDashboard from '../components/BackToDashboard'

const documentCategories = [
  {
    id: 'contracts',
    title: 'Contracts',
    description: 'Purchase agreements, sales contracts, and partnership documents. Manage all your legal binding agreements in one place.',
    icon: FileText,
    count: 12,
  },
  {
    id: 'compliance',
    title: 'Compliance',
    description: 'Regulatory filings, licenses, and compliance certificates. Keep track of all your regulatory requirements and deadlines.',
    icon: ClipboardList,
    count: 8,
  },
  {
    id: 'ndas',
    title: 'NDAs & Agreements',
    description: 'Non-disclosure agreements, confidentiality contracts, and other protective legal documents for your business relationships.',
    icon: FileSignature,
    count: 15,
  },
]

export default function LegalDocumentsPage() {
  const [uploadOpen, setUploadOpen] = useState(false)

  const handleUploadFiles = (files: File[]) => {
    console.log('Uploading files:', files)
    // TODO: Implement actual upload logic
    setUploadOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0d]">
      <div className="max-w-[1400px] mx-auto px-12 py-10">
        <BackToDashboard />
        {/* Header */}
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.25em] opacity-60 text-neutral-400 mb-1">
            LEGAL
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
            Legal Documents
          </h1>
          <p className="text-base opacity-70 text-neutral-300 mb-6">
            Manage and organize all your legal documentation in one secure location.
          </p>
        </div>

        {/* Document Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {documentCategories.map((category) => (
            <DocumentCategoryCard
              key={category.id}
              icon={category.icon}
              title={category.title}
              description={category.description}
              count={category.count}
              onViewAll={() => console.log(`View all ${category.title}`)}
              onUpload={() => setUploadOpen(true)}
            />
          ))}
        </div>

        {/* Other Legal Documents Section */}
        <h3 className="text-xl font-semibold tracking-wide mt-16 mb-4 text-white">
          Other Legal Documents
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-[#ff0a45]/20 bg-[#0a0a0d]/60 backdrop-blur-md h-[140px] flex items-center justify-center text-neutral-500">
            Add custom documents with the + button
          </div>
          <div className="rounded-2xl border border-[#ff0a45]/20 bg-[#0a0a0d]/60 backdrop-blur-md h-[140px] flex items-center justify-center text-neutral-500">
            Your uploaded legal files will appear here
          </div>
        </div>
      </div>

      {/* Floating Upload Button */}
      <UploadFloatingButton onClick={() => setUploadOpen(true)} />

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUploadFiles}
      />
    </div>
  )
}
