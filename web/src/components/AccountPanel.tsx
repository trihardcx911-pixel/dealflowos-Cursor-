import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
  }) => void;
  initialData?: {
    name?: string;
    email?: string;
  };
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const { theme } = useTheme();
  const isLight = theme === 'light';

  React.useEffect(() => {
    if (isOpen && initialData) {
      setName(initialData.name || '');
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only send name (displayName) - backend only supports this field
    onSave({
      name: name.trim(),
    });
    
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/40 backdrop-blur-xl"
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 mx-4 border shadow-[0_0_40px_rgba(255,10,69,0.3)] ${
          isLight
            ? 'bg-white border-[#ff0a45]/40'
            : 'bg-[#0a0a0c] border-[#ff0a45]/40'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${
            isLight ? 'text-[#1a1a1a]' : 'text-white'
          }`}>
            Edit Account
          </h2>
          <button
            onClick={handleClose}
            className={`transition-colors ${
              isLight
                ? 'text-neutral-600 hover:text-[#ff0a45]'
                : 'text-neutral-400 hover:text-[#ff0a45]'
            }`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isLight ? 'text-[#1a1a1a]' : 'text-white'
            }`}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border focus:border-[#ff0a45] focus:shadow-[0_0_10px_#ff0a45] focus:outline-none transition-all ${
                isLight
                  ? 'bg-white border-neutral-300 text-[#1a1a1a] placeholder-neutral-400'
                  : 'bg-black/30 border-white/10 text-white placeholder-neutral-400'
              }`}
              placeholder="John Doe"
              required
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isLight ? 'text-[#1a1a1a]' : 'text-white'
            }`}>
              Email
            </label>
            <input
              type="email"
              value={initialData?.email || ''}
              disabled
              className={`w-full px-4 py-3 rounded-xl border cursor-not-allowed ${
                isLight
                  ? 'bg-neutral-100 border-neutral-200 text-neutral-500'
                  : 'bg-black/20 border-white/5 text-neutral-400'
              }`}
              placeholder="john@example.com"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Email is managed by your sign-in provider.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className={`flex-1 px-4 py-2 rounded-lg border transition-all text-xs font-medium ${
                isLight
                  ? 'border-neutral-300 bg-white text-[#1a1a1a] hover:border-[#ff0a45]/40 hover:text-[#ff0a45]'
                  : 'border-white/10 bg-[#080712]/60 text-neutral-300 hover:border-[#ff0a45]/30 hover:text-[#ff0a45]'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-[#ff0a45] text-white hover:bg-[#ff0a45]/90 shadow-[0_0_8px_#ff0a45] hover:shadow-[0_0_12px_#ff0a45] transition-all text-xs font-medium"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};











