import { useState } from 'react'
import { Edit2, Save, X, ExternalLink } from 'lucide-react'
import { patch } from '../../api'
import { useToast } from '../../useToast'

interface ContractMetadataPanelProps {
  dealId: string
  metadata: any
  onUpdate: () => void
}

export function ContractMetadataPanel({ dealId, metadata, onUpdate }: ContractMetadataPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    sellerName: metadata?.sellerName || '',
    buyerName: metadata?.buyerName || '',
    contractPrice: metadata?.contractPrice || '',
    contractDate: metadata?.contractDate ? new Date(metadata.contractDate).toISOString().split('T')[0] : '',
    externalUrl: metadata?.externalUrl || '',
  })
  const [saving, setSaving] = useState(false)
  const { notify } = useToast()

  const handleSave = async () => {
    try {
      setSaving(true)
      await patch(`/deals/${dealId}/legal/contract`, {
        sellerName: formData.sellerName || undefined,
        buyerName: formData.buyerName || undefined,
        contractPrice: formData.contractPrice ? parseFloat(formData.contractPrice) : undefined,
        contractDate: formData.contractDate || undefined,
        externalUrl: formData.externalUrl || undefined,
      })
      notify('success', 'Contract metadata updated')
      setIsEditing(false)
      onUpdate()
    } catch (err: any) {
      notify('error', err?.error || err?.message || 'Failed to update contract metadata')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      sellerName: metadata?.sellerName || '',
      buyerName: metadata?.buyerName || '',
      contractPrice: metadata?.contractPrice || '',
      contractDate: metadata?.contractDate ? new Date(metadata.contractDate).toISOString().split('T')[0] : '',
      externalUrl: metadata?.externalUrl || '',
    })
    setIsEditing(false)
  }

  return (
    <div className="neon-glass p-6 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Contract</h3>
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
              Seller Name
            </label>
            <input
              type="text"
              value={formData.sellerName}
              onChange={(e) => setFormData({ ...formData, sellerName: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
              placeholder="Seller name"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              Buyer Name
            </label>
            <input
              type="text"
              value={formData.buyerName}
              onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
              placeholder="Buyer name"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              Contract Price
            </label>
            <input
              type="number"
              value={formData.contractPrice}
              onChange={(e) => setFormData({ ...formData, contractPrice: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60"
              placeholder="0.00"
              step="0.01"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-white/60 mb-1 block">
              Contract Date
            </label>
            <input
              type="date"
              value={formData.contractDate}
              onChange={(e) => setFormData({ ...formData, contractDate: e.target.value })}
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
              {metadata.sellerName && (
                <div>
                  <span className="text-white/60">Seller:</span>{' '}
                  <span className="text-white">{metadata.sellerName}</span>
                </div>
              )}
              {metadata.buyerName && (
                <div>
                  <span className="text-white/60">Buyer:</span>{' '}
                  <span className="text-white">{metadata.buyerName}</span>
                </div>
              )}
              {metadata.contractPrice && (
                <div>
                  <span className="text-white/60">Price:</span>{' '}
                  <span className="text-white">${Number(metadata.contractPrice).toLocaleString()}</span>
                </div>
              )}
              {metadata.contractDate && (
                <div>
                  <span className="text-white/60">Date:</span>{' '}
                  <span className="text-white">
                    {new Date(metadata.contractDate).toLocaleDateString()}
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
              {!metadata.sellerName && !metadata.buyerName && !metadata.contractPrice && (
                <div className="text-white/40 italic">No contract metadata yet</div>
              )}
            </>
          ) : (
            <div className="text-white/40 italic">No contract metadata yet</div>
          )}
        </div>
      )}
    </div>
  )
}



