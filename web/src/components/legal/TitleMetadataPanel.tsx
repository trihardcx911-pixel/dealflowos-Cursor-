import { useState } from 'react'
import { Edit2, Save, X, ExternalLink } from 'lucide-react'
import { api } from '../../api/client'
import { useToast } from '../../useToast'

interface TitleMetadataPanelProps {
  dealId: string
  metadata: any
  onUpdate: () => void
}

export function TitleMetadataPanel({ dealId, metadata, onUpdate }: TitleMetadataPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    titleCompany: metadata?.titleCompany || '',
    escrowOfficer: metadata?.escrowOfficer || '',
    escrowNumber: metadata?.escrowNumber || '',
    expectedCloseDate: metadata?.expectedCloseDate ? new Date(metadata.expectedCloseDate).toISOString().split('T')[0] : '',
    externalUrl: metadata?.externalUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const { notify } = useToast()

  const handleSave = async () => {
    try {
      setSaving(true)
      await api.put(`/deals/${dealId}/legal/title`, {
        titleCompany: formData.titleCompany || undefined,
        escrowOfficer: formData.escrowOfficer || undefined,
        escrowNumber: formData.escrowNumber || undefined,
        expectedCloseDate: formData.expectedCloseDate || undefined,
        externalUrl: formData.externalUrl || undefined,
      })
      notify('success', 'Title metadata updated')
      setIsEditing(false)
      onUpdate()
    } catch (err: any) {
      notify('error', err?.error || err?.message || 'Failed to update title metadata')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      titleCompany: metadata?.titleCompany || '',
      escrowOfficer: metadata?.escrowOfficer || '',
      escrowNumber: metadata?.escrowNumber || '',
      expectedCloseDate: metadata?.expectedCloseDate ? new Date(metadata.expectedCloseDate).toISOString().split('T')[0] : '',
      externalUrl: metadata?.externalUrl || '',
    })
    setIsEditing(false)
  }

  return (
    <div className="neon-glass p-6 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Title</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="text-white/60 hover:text-white transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              Title Company
            </label>
            <input
              type="text"
              value={formData.titleCompany}
              onChange={(e) => setFormData({ ...formData, titleCompany: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
              placeholder="Title company name"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              Escrow Officer
            </label>
            <input
              type="text"
              value={formData.escrowOfficer}
              onChange={(e) => setFormData({ ...formData, escrowOfficer: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
              placeholder="Escrow officer name"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              Escrow Number
            </label>
            <input
              type="text"
              value={formData.escrowNumber}
              onChange={(e) => setFormData({ ...formData, escrowNumber: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
              placeholder="Escrow number"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              Expected Close Date
            </label>
            <input
              type="date"
              value={formData.expectedCloseDate}
              onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              External URL
            </label>
            <input
              type="url"
              value={formData.externalUrl}
              onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
              placeholder="https://..."
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {metadata ? (
            <>
              {metadata.titleCompany && (
                <div>
                  <span className="text-white/60">Title Company:</span>{' '}
                  <span className="text-white">{metadata.titleCompany}</span>
                </div>
              )}
              {metadata.escrowOfficer && (
                <div>
                  <span className="text-white/60">Escrow Officer:</span>{' '}
                  <span className="text-white">{metadata.escrowOfficer}</span>
                </div>
              )}
              {metadata.escrowNumber && (
                <div>
                  <span className="text-white/60">Escrow #:</span>{' '}
                  <span className="text-white">{metadata.escrowNumber}</span>
                </div>
              )}
              {metadata.expectedCloseDate && (
                <div>
                  <span className="text-white/60">Expected Close:</span>{' '}
                  <span className="text-white">
                    {new Date(metadata.expectedCloseDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {metadata.externalUrl && (
                <div>
                  <a
                    href={metadata.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#ff0a45] hover:text-[#ff0a45]/80 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View Document
                  </a>
                </div>
              )}
              {!metadata.titleCompany && !metadata.escrowOfficer && (
                <div className="text-white/40 italic">No title metadata yet</div>
              )}
            </>
          ) : (
            <div className="text-white/40 italic">No title metadata yet</div>
          )}
        </div>
      )}
    </div>
  )
}



