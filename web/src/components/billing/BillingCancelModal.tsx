import React, { useEffect, useState } from 'react';

interface BillingCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (payload: { reasonCodes: string[]; otherText: string }) => Promise<void>;
  onResume?: () => Promise<void>;
  onPause30Days: () => void;
  accessEndsAt?: string;
}

const REASON_CODES = [
  { code: 'too_expensive', label: 'Too expensive' },
  { code: 'not_wholesaling_anymore', label: 'Not wholesaling anymore' },
  { code: 'missing_features', label: 'Missing features I need' },
  { code: 'hard_to_use', label: 'Hard to use' },
  { code: 'bugs_or_performance', label: 'Bugs or performance issues' },
  { code: 'found_alternative', label: 'Found a better alternative' },
  { code: 'not_getting_value', label: 'Not getting value' },
  { code: 'other', label: 'Other' },
] as const;

export const BillingCancelModal: React.FC<BillingCancelModalProps> = ({
  isOpen,
  onClose,
  onConfirmCancel,
  onResume,
  onPause30Days,
  accessEndsAt,
}) => {
  const [step, setStep] = useState<'confirm' | 'reasons'>('confirm');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [otherText, setOtherText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('confirm');
      setSelectedReasons([]);
      setOtherText('');
      setIsSubmitting(false);
      setErrorText(null);
    }
  }, [isOpen]);

  const accessDateText = accessEndsAt
    ? formatDate(accessEndsAt)
    : 'the end of your billing period';

  const isResumeMode = !!onResume;

  const handleResumeClick = async () => {
    if (!onResume) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await onResume();
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to resume subscription');
      setIsSubmitting(false);
    }
  };

  const handleToggleReason = (code: string) => {
    setSelectedReasons((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleConfirmCancel = async () => {
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await onConfirmCancel({
        reasonCodes: selectedReasons,
        otherText: otherText.trim(),
      });
    } catch (err: any) {
      setErrorText(err?.message || 'Failed to cancel subscription');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-[9999] bg-black/55 backdrop-blur-xl transition-all duration-200 ${
        isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-white border border-slate-200/70 shadow-[0_30px_90px_rgba(2,6,23,0.15)] mx-4 dark:bg-[#07070a] dark:border-white/10 dark:shadow-[0_30px_90px_rgba(0,0,0,0.75)] dark:ring-1 dark:ring-[#ff0a45]/15"
        onClick={(e) => e.stopPropagation()}
      >
        {/* RESUME MODE CONTAINER */}
        <div className={isResumeMode ? '' : 'hidden'}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Cancel subscription?
            </h2>
          </div>

          <div className="mb-6">
            <p className="text-sm text-slate-600 dark:text-white/60">
              Your subscription is set to cancel at {accessDateText}. You can resume it to continue your subscription.
            </p>
            {errorText && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {errorText}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleResumeClick}
              disabled={isSubmitting}
              className="w-full px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 hover:bg-emerald-500/14 transition-all text-sm font-medium dark:bg-emerald-500/15 dark:border-emerald-500/35 dark:text-emerald-400 dark:hover:bg-emerald-500/22 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Resuming...' : 'Resume subscription'}
            </button>
            <button
              type="button"
              onClick={() => {
                onPause30Days();
              }}
              disabled={true}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#080712]/60 text-slate-400 dark:text-white/30 cursor-not-allowed text-sm font-medium"
              title="Coming soon"
            >
              Pause 30 days (Coming soon)
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#080712]/60 text-slate-700 dark:text-neutral-300 hover:border-[#ff0a45]/30 hover:text-[#ff0a45] transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Keep canceling
            </button>
          </div>
        </div>

        {/* CONFIRM STEP CONTAINER */}
        <div className={!isResumeMode && step === 'confirm' ? '' : 'hidden'}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Are you sure you want to cancel?
            </h2>
          </div>

          <div className="mb-6">
            <p className="text-sm text-slate-600 dark:text-white/60">
              You'll keep access until {accessDateText}. You can reactivate anytime.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setStep('reasons')}
              className="w-full px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 hover:bg-red-500/14 transition-all text-sm font-medium dark:bg-red-500/15 dark:border-red-500/35 dark:text-red-400 dark:hover:bg-red-500/22"
            >
              Yes, continue
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#080712]/60 text-slate-700 dark:text-neutral-300 hover:border-[#ff0a45]/30 hover:text-[#ff0a45] transition-all text-sm font-medium"
            >
              No, keep subscription
            </button>
          </div>
        </div>

        {/* REASONS STEP CONTAINER */}
        <div className={!isResumeMode && step === 'reasons' ? '' : 'hidden'}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Help us improve (optional)
            </h2>
          </div>

          <div className="mb-6">
            <p className="text-sm text-slate-600 dark:text-white/60 mb-4">
              Why are you canceling? Your feedback helps us improve.
            </p>

            <div className="space-y-2 mb-4">
              {REASON_CODES.map((reason) => (
                <label
                  key={reason.code}
                  className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-neutral-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedReasons.includes(reason.code)}
                    onChange={() => handleToggleReason(reason.code)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-[#ff0a45] focus:ring-[#ff0a45]"
                  />
                  <span>{reason.label}</span>
                </label>
              ))}
            </div>

            <div className="mb-2">
              <textarea
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Other (optional)"
                rows={3}
                maxLength={1000}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#080712]/60 text-slate-700 dark:text-neutral-300 placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff0a45] text-sm"
              />
            </div>

            <p className="text-xs text-slate-500 dark:text-white/40 italic">
              Optional — helps us improve.
            </p>

            {errorText && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {errorText}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={isSubmitting}
              className="w-full px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 hover:bg-red-500/14 transition-all text-sm font-medium dark:bg-red-500/15 dark:border-red-500/35 dark:text-red-400 dark:hover:bg-red-500/22 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Canceling...' : 'Cancel subscription'}
            </button>
            <button
              type="button"
              onClick={() => setStep('confirm')}
              disabled={isSubmitting}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#080712]/60 text-slate-700 dark:text-neutral-300 hover:border-[#ff0a45]/30 hover:text-[#ff0a45] transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
