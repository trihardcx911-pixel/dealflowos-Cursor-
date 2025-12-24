import BackToDashboard from '../components/BackToDashboard'

export default function ResourcesPage() {
  return (
    <>
      <BackToDashboard />
      <header className="space-y-2 mb-8 px-12">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Library</p>
        <h1 className="text-xl font-semibold tracking-tight text-white">Resources</h1>
        <p className="text-sm text-white/50">Learn and improve your wholesaling skills</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 px-12 pb-12">
        {/* 1. What Wholesaling Really Is */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-4 min-h-[160px] flex flex-col gap-2">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <path d="M4 7l8-4 8 4-8 4z"/>
            <path d="M4 12l8-4 8 4-8 4z"/>
          </svg>
          <h3 className="text-base font-semibold text-red-500 mb-2">What Wholesaling Really Is</h3>
          <ul className="text-sm text-gray-200 space-y-1 leading-tight">
            <li> You find a discounted property</li>
            <li> You talk to the owner and understand their situation</li>
            <li> You put the property under contract</li>
            <li> You assign the contract to an investor who wants the deal</li>
            <li> You earn a fee for connecting both sides</li>
          </ul>
        </div>

        {/* 2. What Makes a Good Deal */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-4 min-h-[160px] flex flex-col gap-2">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
          <h3 className="text-base font-semibold text-red-500 mb-2">What Makes a Good Deal</h3>
          <ul className="text-sm text-gray-200 space-y-1 leading-tight">
            <li> Owner is motivated to sell</li>
            <li> Property needs work or has a clear reason to discount</li>
            <li> Price leaves room for investor profit</li>
            <li> No serious title problems</li>
            <li> Timeline and expectations are clear</li>
          </ul>
        </div>

        {/* 3. Best Places to Find Leads */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-4 min-h-[160px] flex flex-col gap-2">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <circle cx="11" cy="11" r="6"/>
            <path d="M16 16l4 4"/>
          </svg>
          <h3 className="text-base font-semibold text-red-500 mb-2">Best Places to Find Leads</h3>
          <ul className="text-sm text-gray-200 space-y-1 leading-tight">
            <li> County public records</li>
            <li> Local community groups</li>
            <li> Foreclosure or auction postings</li>
            <li> Exploring neighborhoods</li>
            <li> Talking to neighbors and small businesses</li>
            <li> Everyday online marketplaces</li>
          </ul>
          <p className="text-xs text-white/60 mt-2 italic">Note: Future DealflowOS mobile scanner for tracking routes & distressed property logs.</p>
        </div>

        {/* 4. How to Talk to Sellers */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-4 min-h-[160px] flex flex-col gap-2">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <path d="M4 6h16v10H7l-3 3z"/>
          </svg>
          <h3 className="text-base font-semibold text-red-500 mb-2">How to Talk to Sellers</h3>
          <ul className="text-sm text-gray-200 space-y-1 leading-tight">
            <li> Keep it simple</li>
            <li> Ask about their situation first</li>
            <li> Learn why they're selling</li>
            <li> Ask what outcome they want</li>
            <li> Be honest about what you can and can't do</li>
          </ul>
        </div>

        {/* 5. Rules to Stay Safe Legally */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-4 min-h-[160px] flex flex-col gap-2">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <path d="M12 3l7 4v6c0 5-3.5 8-7 8s-7-3-7-8V7z"/>
          </svg>
          <h3 className="text-base font-semibold text-red-500 mb-2">Rules to Stay Safe Legally</h3>
          <ul className="text-sm text-gray-200 space-y-1 leading-tight">
            <li> Don't act like an agent</li>
            <li> Don't promise repairs</li>
            <li> Don't give legal/financial advice</li>
            <li> Be transparent about your role</li>
            <li> Follow disclosure laws</li>
            <li> Get everything in writing</li>
          </ul>
        </div>

        {/* 6. Tools Every Wholesaler Should Use */}
        <div className="relative rounded-xl bg-black/30 backdrop-blur-xl border border-red-500/20 shadow-[0_0_20px_rgba(255,0,80,0.3)] hover:border-red-500/40 transition-all p-4 min-h-[160px] flex flex-col gap-2">
          <svg className="w-6 h-6 text-red-400/80" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.5">
            <path d="M6 8l4 4-4 4"/>
            <path d="M14 16h4"/>
          </svg>
          <h3 className="text-base font-semibold text-red-500 mb-2">Tools Every Wholesaler Should Use</h3>
          <ul className="text-sm text-gray-200 space-y-1 leading-tight">
            <li> Free business phone line</li>
            <li> E-signature service for contracts</li>
            <li> Cloud folder for document storage</li>
            <li> A CRM to organize leads  DealflowOS becomes the main workspace</li>
          </ul>
          <p className="text-xs text-white/60 mt-2 italic">Future DealflowOS updates: mobile scanner, automated follow-ups, offer generator, buyer handoff tools</p>
        </div>
      </div>
    </>
  )
}
