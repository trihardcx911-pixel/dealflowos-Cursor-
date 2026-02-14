import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PricingSection from "./PricingSection";

const DASHBOARD_SRC = "/dashboard-screenshot.png";

export default function LandingPage() {
  const [imgOk, setImgOk] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Hash scroll support
  useEffect(() => {
    if (location.hash) {
      const hash = location.hash.substring(1);
      const element = document.getElementById(hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [location.hash]);

  const handleNavClick = (path: string) => {
    setMobileMenuOpen(false);
    if (path.startsWith('#')) {
      const hash = path.substring(1);
      if (location.pathname === '/') {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        navigate({ pathname: '/', hash: hash });
      }
    } else {
      navigate(path);
    }
  };

  // Determine active states for pills
  const isPricingActive = location.hash === '#pricing';
  const isFaqsActive = location.hash === '#faqs';
  const isWhyActive = location.hash === '#why';
  const isSupportActive = location.hash === '#support';

  return (
    <div className="min-h-screen w-full text-[#F5F7FA] font-sans bg-gradient-to-b from-[#12141A] to-[#0B0D10] relative">
      {/* Global Background Texture Layer */}
      <div 
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(900px circle at 50% 0%, rgba(255,255,255,0.06), transparent 60%),
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 48px 48px, 48px 48px'
        }}
      />
      
      {/* Content Wrapper */}
      <div className="relative z-10">
      <a
        href="/"
<<<<<<< HEAD
        className="min-[700px]:hidden fixed top-5 left-5 z-[110] flex items-center ml-2"
=======
        className="min-[700px]:hidden fixed top-5 left-8 z-[110] flex items-center"
>>>>>>> eb86b51 (Polish landing header logo placement + SVG halo padding)
        aria-label="DealflowOS home"
      >
        <img
          src="/dealflowos-logo.svg"
          alt="DealflowOS"
          className="h-12 w-12 select-none opacity-90"
          draggable={false}
        />
      </a>
      {/* Mobile-only floating hamburger — visible only on mobile */}
      <div className="min-[700px]:hidden fixed top-4 left-1/2 -translate-x-1/2 z-[110]">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="h-12 w-12 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-md backdrop-saturate-[1.5] shadow-[0_8px_30px_rgba(0,0,0,0.22),0_0_24px_rgba(255,10,69,0.06)] flex items-center justify-center text-[#A8AFB8] hover:text-[#F5F7FA] transition-colors ring-1 ring-white/10"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {/* NAV — desktop pill (hidden on mobile) */}
      <header className="sticky top-0 z-50 px-4 sm:px-6 pt-5 w-full">
<<<<<<< HEAD
        {/* Logo (desktop) — absolute so it doesn't shift the centered pill */}
        <a
          href="/"
          className="hidden min-[700px]:flex absolute left-6 top-6 items-center ml-6"
          aria-label="DealflowOS home"
        >
          <img
            src="/dealflowos-logo.svg"
            alt="DealflowOS"
            className="h-12 w-auto select-none drop-shadow-[0_0_18px_rgba(255,10,69,0.25)]"
            draggable={false}
          />
        </a>
        <div className="hidden min-[700px]:flex justify-center w-full">
=======
        <div className="relative w-full max-w-7xl mx-auto">
          {/* Logo (desktop) — aligned to max-w container left edge, above pill */}
          <a
            href="/"
            className="hidden min-[700px]:flex absolute left-12 top-1/2 -translate-y-1/2 items-center z-[120]"
            aria-label="DealflowOS home"
          >
            <img
              src="/dealflowos-logo.svg"
              alt="DealflowOS"
              className="h-[5.5rem] w-[5.5rem] select-none drop-shadow-[0_0_18px_rgba(255,10,69,0.25)]"
              draggable={false}
            />
          </a>
          <div className="hidden min-[700px]:flex justify-center w-full">
>>>>>>> eb86b51 (Polish landing header logo placement + SVG halo padding)
          <nav className="relative flex w-full max-w-full min-[700px]:inline-flex min-[700px]:w-auto min-[700px]:min-w-0 min-[700px]:max-w-full items-center gap-2 sm:gap-3 rounded-2xl overflow-hidden border border-white/15 ring-1 ring-white/10 bg-black/30 backdrop-blur-md backdrop-saturate-[1.5] shadow-[0_8px_30px_rgba(0,0,0,0.22),0_0_24px_rgba(255,10,69,0.06)] pl-3 pr-2 sm:pl-5 sm:pr-3 py-3 min-w-0">
            {/* Inner highlight — crisp glass edge */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.12] to-transparent pointer-events-none z-0" aria-hidden="true" />
            {/* Specular reflection — soft radial gleam */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-0" style={{ background: 'radial-gradient(circle at 20% 0%, rgba(255,255,255,0.22), transparent 55%)' }} aria-hidden="true" />
            {/* Headband strip — top highlight inside pill */}
            <div className="absolute top-0 left-0 right-0 h-[8px] rounded-t-2xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-0" aria-hidden="true" />
            <div className="relative z-10 flex items-center justify-center w-full min-[700px]:w-auto min-w-0 min-[700px]:justify-start gap-2 sm:gap-3">
              {/* Desktop: pill items + Support + Start */}
              <div className="hidden min-[700px]:flex flex-nowrap items-center gap-2 shrink-0 whitespace-nowrap overflow-x-auto">
                <div className="rounded-full border border-white/10 bg-black/20 px-1 py-1 flex gap-1">
                  <button
                    onClick={() => handleNavClick('#pricing')}
                    className={`px-3 py-1.5 rounded-full text-sm transition shrink-0 ${
                      isPricingActive ? 'bg-white/8 text-[#F5F7FA]' : 'text-[#A8AFB8] hover:text-[#F5F7FA] hover:bg-white/5'
                    }`}
                  >
                    Pricing
                  </button>
                  <button
                    onClick={() => handleNavClick('#faqs')}
                    className={`px-3 py-1.5 rounded-full text-sm transition shrink-0 ${
                      isFaqsActive ? 'bg-white/8 text-[#F5F7FA]' : 'text-[#A8AFB8] hover:text-[#F5F7FA] hover:bg-white/5'
                    }`}
                  >
                    FAQs
                  </button>
                  <button
                    onClick={() => handleNavClick('#why')}
                    className={`px-3 py-1.5 rounded-full text-sm transition shrink-0 ${
                      isWhyActive ? 'bg-white/8 text-[#F5F7FA]' : 'text-[#A8AFB8] hover:text-[#F5F7FA] hover:bg-white/5'
                    }`}
                  >
                    Why this exists
                  </button>
                  <button
                    onClick={() => handleNavClick('#support')}
                    className={`px-3 py-1.5 rounded-full text-sm transition shrink-0 ${
                      isSupportActive ? 'bg-white/8 text-[#F5F7FA]' : 'text-[#A8AFB8] hover:text-[#F5F7FA] hover:bg-white/5'
                    }`}
                  >
                    Support
                  </button>
                </div>
                <Link
                  to="/signup"
                  className="h-9 px-4 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-400 transition-colors shadow-[0_10px_30px_rgba(239,68,68,0.18)] flex items-center justify-center shrink-0"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </nav>
          </div>
        </div>
      </header>

      {/* Mobile fullscreen overlay menu — always in DOM, visibility via classes */}
      <div
        className={`min-[700px]:hidden fixed inset-0 z-[100] transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
        <div
          id="mobile-menu"
          className="absolute top-20 left-4 right-4 rounded-2xl border border-white/15 ring-1 ring-white/10 bg-white/[0.04] backdrop-blur-md backdrop-saturate-[1.5] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => handleNavClick('#pricing')} className="block w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors" style={{ color: isPricingActive ? '#F5F7FA' : '#A8AFB8' }}>Pricing</button>
          <button onClick={() => handleNavClick('#faqs')} className="block w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors" style={{ color: isFaqsActive ? '#F5F7FA' : '#A8AFB8' }}>FAQs</button>
          <button onClick={() => handleNavClick('#why')} className="block w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors" style={{ color: isWhyActive ? '#F5F7FA' : '#A8AFB8' }}>Why this exists</button>
          <button onClick={() => handleNavClick('#support')} className="block w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors" style={{ color: isSupportActive ? '#F5F7FA' : '#A8AFB8' }}>Support</button>
          <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="block w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-white/5 transition-colors" style={{ color: '#EF4444' }}>Sign up</Link>
        </div>
      </div>

      {/* HERO */}
      <section className="min-h-[80vh] flex items-center justify-center px-8 pt-24 min-[700px]:pt-0">
        <div className="relative w-full max-w-[720px]">
          {/* Halo behind HERO */}
          <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,rgba(239,68,68,0.10),transparent_70%)] blur-3xl opacity-20 z-0" />
          <div className="relative z-10 rounded-2xl bg-white/3 border border-white/5 px-8 py-10 text-center">
            <h1 className="text-[44px] font-semibold leading-[1.15] text-[#F5F7FA] mb-6">
              Running real estate wholesale deals shouldn't feel this chaotic.
            </h1>
            <div className="flex flex-col items-center gap-3 mt-8">
              <p className="text-[13px] text-[#7C828A] mb-2">
                Track sellers, properties, follow-ups, and contracts in one calm workspace — without fighting your CRM.
              </p>
              <Link
                to="/signup"
                className="h-12 px-7 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors text-center flex items-center justify-center"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="mx-auto my-16 h-px w-full max-w-5xl bg-white/5" />

      {/* AUDIENCE QUALIFIER */}
      <section className="py-20 px-8 flex justify-center">
        <div className="max-w-[720px] mx-auto bg-white/5 border border-white/5 rounded-2xl px-6 py-4 md:px-8 md:py-5 text-center">
          <p className="text-[18px] leading-relaxed text-[#A8AFB8]">
            Built for solo wholesalers and early-stage operators who need less noise, not more features.
          </p>
        </div>
      </section>

      {/* PROBLEM → RELIEF */}
      <section className="px-8 py-32 flex justify-center">
        <div className="max-w-[720px] mx-auto bg-white/5 border border-white/5 rounded-2xl px-6 py-10 md:px-10 md:py-12 text-center">
          <p className="text-[16px] leading-relaxed text-[#A8AFB8]">
            You're tracking a motivated seller in a spreadsheet, follow-ups in your calendar, and contracts in email — and you just missed calling a property owner back because the deal slipped through the cracks.
          </p>
          <p className="text-[16px] leading-relaxed text-[#A8AFB8] mt-6">
            This shouldn't be how you run real estate deals.
          </p>
          <p className="text-[16px] leading-relaxed text-[#A8AFB8] mt-6">
            DealflowOS keeps every seller, property, follow-up, and document tied to the deal — without forcing you to learn a bloated system.
          </p>
        </div>
      </section>

      {/* SEE WHAT IT LOOKS LIKE */}
      <section id="preview" className="pt-32 pb-32 px-8 flex justify-center">
        <div className="w-full max-w-[min(100%,1000px)] text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4" style={{ color: '#F5F7FA' }}>
            See what it looks like
          </h2>
          <p className="text-[16px] leading-relaxed mb-12 max-w-xl mx-auto" style={{ color: '#A8AFB8' }}>
            A quiet dashboard: what needs attention, your pipeline, and today's next actions.
          </p>
          
          <div className="relative rounded-2xl bg-white/12 border border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden">
            {/* Halo behind Screenshot */}
            <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,rgba(239,68,68,0.10),transparent_70%)] blur-3xl opacity-20 z-0" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/6 to-transparent pointer-events-none rounded-2xl z-0"></div>
            <div className="relative z-10 w-full max-w-full overflow-hidden bg-white/5 min-h-[200px]">
              {imgOk ? (
                <img 
                  src={DASHBOARD_SRC} 
                  alt="DealflowOS dashboard showing deals, follow-ups, and next actions"
                  className="w-full h-auto object-contain"
                  onError={() => setImgOk(false)}
                />
              ) : (
                <div className="w-full min-h-[200px] flex items-center justify-center">
                  <div className="text-center px-8">
                    <p className="text-[16px] leading-relaxed" style={{ color: '#A8AFB8' }}>
                      Dashboard preview
                    </p>
                    <p className="text-[14px] mt-2" style={{ color: '#7C828A' }}>
                      Add dashboard-screenshot.png to /public folder
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <p className="text-[14px] leading-relaxed mt-6" style={{ color: '#7C828A' }}>
            One screen. Deals, follow-ups, and the next step—without noise.
          </p>
        </div>
      </section>

      {/* GROUNDING ARTIFACT */}
      <section className="px-8 py-20 flex justify-center">
        <div className="w-full max-w-[680px]">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-6 md:px-8 md:py-8">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-[13px] text-[#7C828A]">Seller</span>
              <span className="text-[13px] text-[#A8AFB8]">Property: 123 Maple St</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-[13px] text-[#7C828A]">Seller follow-up</span>
              <span className="text-[13px] text-[#A8AFB8]">Call property owner</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-[13px] text-[#7C828A]">Next deal step</span>
              <span className="text-[13px] text-[#A8AFB8]">Send assignment agreement</span>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT HAPPENS WHEN YOU START */}
      <section className="pt-40 pb-32 px-8 flex justify-center">
        <div className="max-w-3xl w-full text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-6" style={{ color: '#F5F7FA' }}>
            What happens when you start?
          </h2>
          <p className="text-base md:text-lg max-w-xl mx-auto mb-16" style={{ color: '#A8AFB8' }}>
            You get a clean workspace built for real estate wholesaling.
            No setup maze. No pressure to do everything.
            Just enough structure to move your first property deal forward.
          </p>

          <div className="relative rounded-2xl bg-white/16 border border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.45)] px-8 pt-6 pb-8 md:px-10 md:pt-8 md:pb-10 space-y-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/6 to-transparent pointer-events-none rounded-2xl"></div>
            <div className="relative space-y-8">
              <div>
                <svg className="w-6 h-6 text-red-400 opacity-90 mb-3 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="16" rx="4" />
                </svg>
                <div className="text-xs tracking-widest mb-2" style={{ color: '#7C828A' }}>STEP 1</div>
                <div className="text-lg font-medium mb-1" style={{ color: '#F5F7FA' }}>
                  You land in a quiet wholesaling workspace
                </div>
                <div className="text-[16px] leading-relaxed" style={{ color: '#A8AFB8' }}>
                  Nothing flashing. No dashboards yelling for attention. Just sellers, properties, and deals.
                </div>
              </div>

              <div>
                <svg className="w-6 h-6 text-red-400 opacity-90 mb-3 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="4" y="2" width="16" height="4" rx="1" />
                  <rect x="4" y="10" width="16" height="4" rx="1" />
                  <rect x="4" y="18" width="16" height="4" rx="1" />
                </svg>
                <div className="text-xs tracking-widest mb-2" style={{ color: '#7C828A' }}>STEP 2</div>
                <div className="text-lg font-medium mb-1" style={{ color: '#F5F7FA' }}>
                  You add one property deal
                </div>
                <div className="text-[16px] leading-relaxed" style={{ color: '#A8AFB8' }}>
                  Seller, property address, and follow-up. The system stays out of your way.
                </div>
              </div>

              <div>
                <svg className="w-6 h-6 text-red-400 opacity-90 mb-3 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="12" r="2" />
                  <path d="M10 12h8" />
                  <path d="M16 10l2 2-2 2" />
                </svg>
                <div className="text-xs tracking-widest mb-2" style={{ color: '#7C828A' }}>STEP 3</div>
                <div className="text-lg font-medium mb-1" style={{ color: '#F5F7FA' }}>
                  You know what to do next
                </div>
                <div className="text-[16px] leading-relaxed" style={{ color: '#A8AFB8' }}>
                  No guessing. No clutter. Just the next seller follow-up or deal step.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16">
            <p className="text-sm text-white/50 mb-6">
              If wholesaling feels harder than it should, this is a good place to start.
            </p>
            <Link
              to="/signup"
              className="inline-block h-12 px-7 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors text-center flex items-center justify-center"
            >
              Start with one deal
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURE CONFIDENCE */}
      <section className="pt-40 pb-32 px-8 flex justify-center">
        <div className="max-w-[720px] mx-auto bg-white/5 border border-white/5 rounded-2xl px-6 py-10 md:px-10 md:py-12 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-6">
            What you actually need is here
          </h2>
          <p className="text-[16px] leading-relaxed text-[#A8AFB8]">
            Track every seller and property deal without hunting through tabs. Set seller follow-ups and see what needs your attention today. Manage assignment agreements and contracts in one place. Know your deal numbers without staring at dashboards.
          </p>
          <p className="text-[16px] leading-relaxed text-[#A8AFB8] mt-6">
            This is a real estate wholesaling CRM. It just doesn't make you feel like you're flying a plane.
          </p>
        </div>
      </section>

      {/* QUIET CREDIBILITY */}
      <section id="why" className="pt-32 pb-24 px-8 flex justify-center">
        <div className="max-w-[640px] mx-auto bg-white/5 border border-white/5 rounded-2xl px-6 py-4 md:px-8 md:py-5 text-center space-y-4">
          <p className="text-[15px] leading-relaxed text-[#7C828A]">
            Built slowly, on purpose
          </p>
          <p className="text-[15px] leading-relaxed text-[#7C828A]">
            Currently in private use by wholesalers who were tired of fighting their CRM
          </p>
          <p className="text-[15px] leading-relaxed text-[#7C828A]">
            Not venture-backed. Not trying to be everything.
          </p>
        </div>
      </section>

      {/* Section Divider */}
      <div className="mx-auto my-16 h-px w-full max-w-5xl bg-white/5" />

      {/* PRICING */}
      <PricingSection />

      {/* Section Divider */}
      <div className="mx-auto my-16 h-px w-full max-w-5xl bg-white/5" />

      {/* CLOSURE CARD */}
      <section className="pt-36 pb-32 px-6 sm:px-8 flex justify-center">
        <div className="max-w-[720px] w-full">
          <div className="rounded-2xl bg-white/12 border border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.45)] px-6 py-10 md:px-10 md:py-12 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold mb-6" style={{ color: '#F5F7FA' }}>
              A calm place to run your first deal.
            </h2>
            <div className="space-y-3 mb-10">
              <p className="text-[16px] leading-relaxed" style={{ color: '#A8AFB8' }}>
                No setup maze.
              </p>
              <p className="text-[16px] leading-relaxed" style={{ color: '#A8AFB8' }}>
                Everything tied to the deal: follow-ups, documents, next step.
              </p>
              <p className="text-[16px] leading-relaxed" style={{ color: '#A8AFB8' }}>
                Start with one deal. Expand when you're ready.
              </p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <Link
                to="/signup"
                className="inline-block h-12 px-7 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors text-center flex items-center justify-center"
              >
                Start with one deal
              </Link>
              <Link
                to="#preview"
                className="inline-block h-12 px-7 rounded-xl border border-white/20 text-white/70 font-medium hover:border-white/30 hover:text-white/90 transition-colors text-center flex items-center justify-center"
              >
                See what it looks like first
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faqs" className="pt-32 pb-32 px-6 sm:px-8 flex justify-center">
        <div className="max-w-[720px] w-full text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4" style={{ color: '#F5F7FA' }}>
            FAQs
          </h2>
          <p className="text-[16px] leading-relaxed mb-12 max-w-xl mx-auto" style={{ color: '#A8AFB8' }}>
            Short answers to the questions people ask before they start.
          </p>
          <div className="space-y-4 text-left">
            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                Is this for beginners or experienced wholesalers?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                Both. It's simple enough for your first deal and stays useful as you scale. No learning curve that gets in the way.
              </p>
            </details>

            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                Do I need to set anything up before using it?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                No setup maze. Add your first deal and you're running. Everything else is optional.
              </p>
            </details>

            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                What exactly can I do in DealflowOS right now?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                Track leads and deals, set follow-ups and see what needs your attention today, manage contracts and documents in one place, know your basic numbers, and see the next clear action.
              </p>
            </details>

            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                Can I use this on my phone?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                Yes, it's responsive. Best experience on desktop, but mobile works well for check-ins and quick updates.
              </p>
            </details>

            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                Will I outgrow it?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                Designed to stay usable as you scale. It avoids noise and handles more deals without becoming chaotic.
              </p>
            </details>

            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                Is there a free trial?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                Yes — you can start with a free trial during early access. Pricing will stay simple when it's finalized.
              </p>
            </details>

            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                Can I import my data?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                Import is planned. You'll be able to bring in leads and deals from a CSV so you can start without retyping everything.
              </p>
            </details>

            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                Does this replace my calendar / email?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                It keeps deal context in one place so you reduce tab switching. You can still use your existing tools.
              </p>
            </details>

            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                Is my data private and secure?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                Yes. Your data is encrypted in transit and protected with standard account security practices. We don't sell your data, and we only use it to provide the service you signed up for.
              </p>
            </details>

            <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
              <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                How do I get help if I'm stuck?
              </summary>
              <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                Email questions@dealflowos.com and include a screenshot plus what you were trying to do. We reply directly—typically within 1–2 business days.
              </p>
            </details>
          </div>

          {/* Refunds Subsection */}
          <div className="mt-12 text-left">
            <h3 className="text-xl font-semibold mb-6" style={{ color: '#F5F7FA' }}>
              Refunds
            </h3>
            <div className="space-y-4">
              <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
                <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                  Do you offer refunds?
                </summary>
                <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                  Payments are generally non-refundable. Refunds are available for billing errors, verified "paid but no access" issues, and verified cancellation failures. We may also offer a limited one-time courtesy refund for accidental renewals if you contact us within 48 hours and usage is minimal.
                </p>
              </details>

              <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
                <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                  If I cancel, do I lose access immediately?
                </summary>
                <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                  No. If you cancel, you keep access through the end of your current paid period. Your subscription will not renew after that.
                </p>
              </details>

              <details className="rounded-xl border border-white/10 bg-white/5 px-6 py-4">
                <summary className="cursor-pointer font-medium mb-2" style={{ color: '#F5F7FA' }}>
                  I forgot to cancel and got charged—what can I do?
                </summary>
                <p className="text-[16px] leading-relaxed mt-3" style={{ color: '#A8AFB8' }}>
                  Contact support within 48 hours of the renewal charge. If usage after renewal is minimal and you haven't used a courtesy refund in the last 12 months, we may issue a one-time courtesy refund.
                </p>
              </details>
            </div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="mx-auto my-16 h-px w-full max-w-5xl bg-white/5" />

      {/* FOOTER */}
      <footer className="py-12 px-6 sm:px-8 border-t border-white/5">
        <div className="max-w-[640px] mx-auto text-center">
          <section id="support" className="mb-6">
            <p className="text-[13px] mb-2" style={{ color: '#7C828A' }}>Support: <a href="mailto:support@dealflowos.com" className="text-[#A8AFB8] hover:text-white/80 transition-colors underline">support@dealflowos.com</a></p>
          </section>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-[13px] mb-4" style={{ color: '#7C828A' }}>
            <a href="mailto:questions@dealflowos.com" className="hover:text-white/80 transition-colors">
              Questions? questions@dealflowos.com
            </a>
            <span className="hidden md:inline">|</span>
            <a href="#" className="hover:text-white/80 transition-colors">
              Why this exists
            </a>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 text-[13px]" style={{ color: '#7C828A' }}>
            <p>© {new Date().getFullYear()} DealflowOS</p>
            <span className="hidden md:inline">|</span>
            <Link to="/terms" className="hover:text-white/80 hover:underline transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
