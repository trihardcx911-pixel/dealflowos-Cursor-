import React from "react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* NAVBAR */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#FF1E1E]/40">
        <div className="text-2xl font-bold text-[#FF1E1E] tracking-wide">
          Dealflow<span className="text-white">OS</span>
        </div>
        <nav className="hidden md:flex gap-6 text-sm font-medium">
          <Link to="/features" className="hover:text-[#FF1E1E]">Features</Link>
          <Link to="/pricing" className="hover:text-[#FF1E1E]">Pricing</Link>
          <Link to="/support" className="hover:text-[#FF1E1E]">Support</Link>
        </nav>
        <Link
          to="/beta"
          className="border border-[#FF1E1E]/60 px-4 py-2 rounded-lg hover:border-[#FF1E1E] hover:shadow-[0_0_15px_#FF1E1E55]"
        >
          Join Beta
        </Link>
      </header>

      {/* HERO */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-20">
        <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4">
          Wholesale <span className="text-[#FF1E1E]">Smarter</span>, Not Harder.
        </h1>
        <p className="max-w-xl text-gray-300 text-lg mb-8">
          Find motivated sellers, manage follow-ups, and close deals faster — all from one clean dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            to="/beta"
            className="bg-[#FF1E1E] text-black font-bold px-6 py-3 rounded-xl hover:shadow-[0_0_25px_#FF1E1E88] transition"
          >
            Start Free
          </Link>
          <a
            href="#demo"
            className="border border-[#FF1E1E]/60 text-white px-6 py-3 rounded-xl hover:border-[#FF1E1E] hover:shadow-[0_0_15px_#FF1E1E55]"
          >
            Watch Demo
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-16 border-t border-[#FF1E1E]/20">
        <h2 className="text-2xl font-semibold text-center text-[#FF1E1E] mb-10">
          Core Features
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            {
              title: "Verified Leads",
              desc: "Access clean, verified homeowner data with just one click.",
              icon: "🏠",
            },
            {
              title: "Follow-Up Automation",
              desc: "Get reminders and automate messages so no lead slips through.",
              icon: "⏰",
            },
            {
              title: "Deal Dashboard",
              desc: "Track offers, KPIs, and conversion rates in one sleek view.",
              icon: "📈",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-[#111] border border-[#FF1E1E]/20 rounded-2xl p-6 text-center hover:shadow-[0_0_20px_#FF1E1E33] transition"
            >
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 py-20 border-t border-[#FF1E1E]/20 bg-[#0A0A0A]">
        <h2 className="text-2xl text-[#FF1E1E] text-center mb-8">Pricing</h2>
        <div className="max-w-md mx-auto border border-[#FF1E1E]/30 rounded-2xl p-8 bg-black text-center hover:shadow-[0_0_25px_#FF1E1E44]">
          <h3 className="text-xl font-semibold mb-4">Bronze Tier</h3>
          <p className="text-gray-400 mb-6">Perfect for new wholesalers starting their first deals.</p>
          <p className="text-5xl font-bold text-white mb-4">
            $20<span className="text-gray-400 text-lg">/mo</span>
          </p>
          <Link
            to="/beta"
            className="bg-[#FF1E1E] text-black font-bold px-6 py-3 rounded-xl hover:shadow-[0_0_25px_#FF1E1E88] transition"
          >
            Start Beta Free
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-20 border-t border-[#FF1E1E]/20">
        <h2 className="text-3xl font-semibold mb-4">
          Ready to start closing deals?
        </h2>
        <Link
          to="/beta"
          className="bg-[#FF1E1E] text-black px-8 py-3 rounded-xl font-bold hover:shadow-[0_0_25px_#FF1E1E77]"
        >
          Get Started Now
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="text-center text-gray-500 py-6 text-sm border-t border-[#FF1E1E]/20">
        © 2025 DealflowOS · <a href="/terms" className="hover:text-[#FF1E1E]">Terms</a> ·{" "}
        <a href="/privacy" className="hover:text-[#FF1E1E]">Privacy</a>
      </footer>
    </div>
  );
}
