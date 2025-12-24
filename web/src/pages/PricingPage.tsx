import React from "react";
import { Link } from "react-router-dom";

export default function PricingPage() {
  return (
    <div className="min-h-screen w-full text-[#F5F7FA] font-sans bg-gradient-to-b from-[#12141A] to-[#0B0D10]">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="text-[16px] font-semibold text-[#F5F7FA] hover:text-white/80 transition-colors">
          DealflowOS
        </Link>
      </header>

      {/* CONTENT */}
      <section className="min-h-[80vh] flex items-center justify-center px-6 sm:px-8 py-20">
        <div className="max-w-[720px] w-full text-center">
          <h1 className="text-4xl md:text-5xl font-semibold mb-6" style={{ color: '#F5F7FA' }}>
            Pricing
          </h1>
          <p className="text-[18px] leading-relaxed mb-12 max-w-xl mx-auto" style={{ color: '#A8AFB8' }}>
            Start free during early access. No credit card required.
          </p>
          
          <div className="rounded-2xl bg-white/12 border border-white/12 shadow-[0_20px_60px_rgba(0,0,0,0.45)] px-6 py-10 md:px-10 md:py-12 mb-8">
            <p className="text-[16px] leading-relaxed mb-8" style={{ color: '#A8AFB8' }}>
              Pricing will be simple when it's finalized. For now, start free and use everything.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link
                to="/signup"
                className="inline-block h-12 px-7 rounded-xl bg-red-500 text-white font-medium hover:bg-red-400 transition-colors"
              >
                Start with one deal
              </Link>
              <Link
                to="/#faqs"
                className="text-[14px] hover:text-white/80 transition-colors"
                style={{ color: '#7C828A' }}
              >
                Read FAQs →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

