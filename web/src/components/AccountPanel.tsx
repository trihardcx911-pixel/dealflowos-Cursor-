import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AccountPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    email: string;
    phone: string;
    password?: string;
  }) => void;
  initialData?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  React.useEffect(() => {
    if (isOpen && initialData) {
      setName(initialData.name || '');
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password && password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (password && password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    onSave({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      ...(password ? { password } : {}),
    });
    
    setPassword('');
    setConfirmPassword('');
    onClose();
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/40 backdrop-blur-xl"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-[#0a0a0c] border border-[#ff0a45]/40 shadow-[0_0_40px_rgba(255,10,69,0.3)] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Edit Account
          </h2>
          <button
            onClick={handleClose}
            className="text-neutral-400 hover:text-[#ff0a45] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-neutral-400 focus:border-[#ff0a45] focus:shadow-[0_0_10px_#ff0a45] focus:outline-none transition-all"
              placeholder="John Doe"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-neutral-400 focus:border-[#ff0a45] focus:shadow-[0_0_10px_#ff0a45] focus:outline-none transition-all"
              placeholder="john@example.com"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-neutral-400 focus:border-[#ff0a45] focus:shadow-[0_0_10px_#ff0a45] focus:outline-none transition-all"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          {/* Password Section */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-sm font-medium text-white mb-4">Change Password</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-neutral-400 focus:border-[#ff0a45] focus:shadow-[0_0_10px_#ff0a45] focus:outline-none transition-all"
                  placeholder="Leave blank to keep current password"
                  minLength={8}
                />
              </div>

              {password && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-neutral-400 focus:border-[#ff0a45] focus:shadow-[0_0_10px_#ff0a45] focus:outline-none transition-all"
                    placeholder="Confirm new password"
                    minLength={8}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg border border-white/10 bg-[#080712]/60 text-neutral-300 hover:border-[#ff0a45]/30 hover:text-[#ff0a45] transition-all text-xs font-medium"
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











