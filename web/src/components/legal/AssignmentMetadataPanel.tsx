import { useState } from 'react'
import { Edit2, Save, X, ExternalLink } from 'lucide-react'
import { api } from '../../api/client'
import { useToast } from '../../useToast'

interface AssignmentMetadataPanelProps {
  dealId: string
  metadata: any
  onUpdate: () => void
}

export function AssignmentMetadataPanel({ dealId, metadata, onUpdate }: AssignmentMetadataPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    endBuyerName: metadata?.endBuyerName || '',
    assignmentFee: metadata?.assignmentFee || '',
    assignmentDate: metadata?.assignmentDate ? new Date(metadata.assignmentDate).toISOString().split('T')[0] : '',
    externalUrl: metadata?.externalUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const { notify } = useToast()

  const handleSave = async () => {
    try {
      setSaving(true)
      await api.put(`/deals/${dealId}/legal/assignment`, {
        endBuyerName: formData.endBuyerName || undefined,
        assignmentFee: formData.assignmentFee ? parseFloat(formData.assignmentFee) : undefined,
        assignmentDate: formData.assignmentDate || undefined,
        externalUrl: formData.externalUrl || undefined,
      })
      notify('success', 'Assignment metadata updated')
      setIsEditing(false)
      onUpdate()
    } catch (err: any) {
      notify('error', err?.error || err?.message || 'Failed to update assignment metadata')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      endBuyerName: metadata?.endBuyerName || '',
      assignmentFee: metadata?.assignmentFee || '',
      assignmentDate: metadata?.assignmentDate ? new Date(metadata.assignmentDate).toISOString().split('T')[0] : '',
      externalUrl: metadata?.externalUrl || '',
    })
    setIsEditing(false)
  }

  return (
    <div className="neon-glass p-6 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Assignment</h3>
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
              End Buyer Name
            </label>
            <input
              type="text"
              value={formData.endBuyerName}
              onChange={(e) => setFormData({ ...formData, endBuyerName: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
              placeholder="End buyer name"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              Assignment Fee
            </label>
            <input
              type="number"
              value={formData.assignmentFee}
              onChange={(e) => setFormData({ ...formData, assignmentFee: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
              placeholder="0.00"
              step="0.01"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              Assignment Date
            </label>
            <input
              type="date"
              value={formData.assignmentDate}
              onChange={(e) => setFormData({ ...formData, assignmentDate: e.target.value })}
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
              {metadata.endBuyerName && (
                <div>
                  <span className="text-white/60">End Buyer:</span>{' '}
                  <span className="text-white">{metadata.endBuyerName}</span>
                </div>
              )}
              {metadata.assignmentFee && (
                <div>
                  <span className="text-white/60">Fee:</span>{' '}
                  <span className="text-white">${Number(metadata.assignmentFee).toLocaleString()}</span>
                </div>
              )}
              {metadata.assignmentDate && (
                <div>
                  <span className="text-white/60">Date:</span>{' '}
                  <span className="text-white">
                    {new Date(metadata.assignmentDate).toLocaleDateString()}
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
              {!metadata.endBuyerName && !metadata.assignmentFee && (
                <div className="text-white/40 italic">No assignment metadata yet</div>
              )}
            </>
          ) : (
            <div className="text-white/40 italic">No assignment metadata yet</div>
          )}
        </div>
      )}
    </div>
  )
}



