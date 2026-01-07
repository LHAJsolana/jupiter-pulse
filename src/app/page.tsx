"use client";

import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-gradient-to-b from-black via-[#0b0f1a] to-black text-white">

      {/* HEADER */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center px-6 py-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          Jupiter Pulse <span className="text-yellow-400">⚡</span>
        </h1>
      </header>

      {/* HERO (NO CTA) */}
      <section className="max-w-3xl">
        <h2 className="text-5xl font-extrabold mb-6 leading-tight">
          🚀 Real-Time Market Pulse
          <br />
          for the <span className="text-[#14F195]">Jupiter</span> Ecosystem
        </h2>

        <p className="text-gray-400 text-lg">
          Jupiter Pulse is a real-time observability dashboard for Solana tokens —
          live prices, historical charts, and market momentum, built for speed and clarity.
        </p>
      </section>

      {/* ECOSYSTEM */}
      <section className="mt-20 flex flex-col items-center gap-6">
        <p className="text-gray-500 uppercase tracking-widest text-sm">
          Built on
        </p>

        <div className="flex items-center gap-10 opacity-90">
          <Image
            src="/solana.svg"
            alt="Solana"
            width={90}
            height={30}
            className="opacity-80"
          />
          <Image
            src="/jupiter.svg"
            alt="Jupiter"
            width={90}
            height={30}
            className="opacity-80"
          />
        </div>
      </section>

      {/* FEATURES = NAVIGATION */}
      <section className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
        {/* LIVE PRICES */}
        <Link href="/pulse" className="group">
          <div className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur hover:scale-[1.02] transition cursor-pointer h-full">
            <h3 className="text-xl font-bold mb-2 group-hover:text-[#14F195]">
              Live Prices
            </h3>
            <p className="text-gray-400">
              Auto-refreshing token prices with fallback protection.
            </p>
          </div>
        </Link>

        {/* CHARTS */}
        <Link href="/pulse" className="group">
          <div className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur hover:scale-[1.02] transition cursor-pointer h-full">
            <h3 className="text-xl font-bold mb-2 group-hover:text-[#14F195]">
              Charts & History
            </h3>
            <p className="text-gray-400">
              Clean historical charts powered by CoinGecko.
            </p>
          </div>
        </Link>

        {/* LIVE SWAPS */}
        <Link href="/liveswaps" className="group">
          <div className="p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur hover:scale-[1.02] transition cursor-pointer h-full">
            <h3 className="text-xl font-bold mb-2 group-hover:text-[#14F195]">
              Live Swap Pulse
            </h3>
            <p className="text-gray-400">
              Track real-time Solana swap flow & route dominance.
            </p>
          </div>
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="mt-24 mb-6 text-gray-500 text-sm">
        Built by{" "}
        <a
          href="https://x.com/lhajsol"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-semibold hover:text-[#00FFA3] transition"
        >
          @lhajsol
        </a>{" "}
        • Powered by Jupiter & Solana ⚡
      </footer>
    </div>
  );
}
