import { useNavigate } from 'react-router-dom'

export function SettingsUsage() {
  const navigate = useNavigate()

  // Stub billing data (will be replaced with real data from BillingPage API later)
  const planName = 'Pro'
  const planStatus = 'Active'
  const renewalDate = new Date()
  renewalDate.setDate(renewalDate.getDate() + 30) // 30 days from now
  const paymentMethodBrand = 'Visa'
  const paymentMethodLast4 = '4242'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Usage & Billing</h2>
        <p className="text-sm text-white/60">Manage your subscription, payment method, and invoices</p>
      </div>

      <div
        className="relative rounded-[32px] bg-[#0a0a0c]/60 border border-[#ff0a45]/25 backdrop-blur-xl shadow-[0_0_40px_rgba(255,10,69,0.18)] p-8 space-y-6 cursor-pointer hover:border-[#ff0a45]/40 hover:shadow-[0_0_50px_rgba(255,10,69,0.25)] hover:z-10 focus-within:border-[#ff0a45]/40 focus-within:shadow-[0_0_50px_rgba(255,10,69,0.25)] focus-within:z-10 focus-within:outline-none transition-all"
        onClick={() => navigate('/settings/billing')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate('/settings/billing')
          }
        }}
      >
        {/* Billing Summary */}
        <div className="space-y-3">
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Plan</span>
              <span className="text-white font-medium">{planName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Status</span>
              <span className="text-white font-medium">{planStatus}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Renewal</span>
              <span className="text-white font-medium">{renewalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Payment Method</span>
              <span className="text-white font-medium">{paymentMethodBrand} •••• {paymentMethodLast4}</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          className="w-full py-2.5 px-4 bg-[rgba(255,0,60,0.12)] border border-[rgba(255,0,60,0.18)] rounded-lg text-[#ff0a45] font-medium text-sm hover:bg-[rgba(255,0,60,0.18)] transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            navigate('/settings/billing')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              navigate('/settings/billing')
            }
          }}
        >
          Manage Billing
        </button>
      </div>
    </div>
  )
}
