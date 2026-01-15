"use client";

import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0b0f1a] to-black text-white">
      {/* HEADER */}
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          Jupiter Pulse <span className="text-yellow-400">⚡</span>
        </h1>

        <Link
          href="/pulse"
          className="text-sm text-gray-300 hover:text-[#14F195] transition"
        >
          Enter App →
        </Link>
      </header>

      {/* CONTENT WRAPPER (keeps everything tight + centered) */}
      <main className="mx-auto w-full max-w-7xl px-6">
        {/* HERO */}
        <section className="pt-10 pb-6 text-center">
          <h2 className="text-5xl md:text-6xl font-extrabold leading-tight">
            🚀 Real-Time Market Pulse
            <br />
            for the <span className="text-[#14F195]">Jupiter</span> Ecosystem
          </h2>

          <p className="mt-4 text-gray-400 text-lg md:text-xl max-w-3xl mx-auto">
            Jupiter Pulse is a real-time observability dashboard for Solana tokens —
            live prices, historical charts, signals, and smart money flow.
          </p>
        </section>

        {/* BUILT ON */}
        <section className="py-4 flex flex-col items-center gap-2">
          <p className="text-gray-500 uppercase tracking-widest text-xs">
            Built on
          </p>
          <div className="flex items-center gap-10 opacity-90">
            <Image src="/solana.svg" alt="Solana" width={84} height={28} />
            <Image src="/jupiter.svg" alt="Jupiter" width={84} height={28} />
          </div>
        </section>

        {/* CARDS */}
        <section className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/pulse" className="group">
              <Card
                title="Live Prices"
                desc="Auto-refreshing token prices with fallback protection."
                icon="📈"
              />
            </Link>

            <Link href="/liveswaps" className="group">
              <Card
                title="Live Swap Pulse"
                desc="Real-time whale swaps & route dominance across Jupiter."
                icon="🐳"
                highlight
              />
            </Link>

            <Link href="/signals" className="group">
              <Card
                title="Market Signals"
                desc="Whale accumulation, distribution & momentum alerts."
                icon="⚡"
              />
            </Link>
          </div>
        </section>

        {/* FOOTER (tight under cards) */}
        <footer className="py-4 text-gray-500 text-sm text-center">
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
      </main>
    </div>
  );
}

function Card({
  title,
  desc,
  icon,
  highlight,
}: {
  title: string;
  desc: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "relative rounded-2xl border p-6 md:p-7 h-[160px] md:h-[175px]",
        "bg-black/50 backdrop-blur",
        "transition-all duration-300",
        "hover:scale-[1.015] hover:border-white/25",
        highlight
          ? "border-[#14F195]/60 bg-[#14F195]/5 shadow-[0_0_45px_rgba(20,241,149,0.18)]"
          : "border-white/10",
      ].join(" ")}
    >
      {/* top row */}
      <div className="flex items-start justify-between">
        <div className="text-3xl">{icon}</div>

        {highlight ? (
          <div className="px-3 py-1 rounded-full text-xs font-semibold bg-[#14F195] text-black">
            LIVE
          </div>
        ) : (
          <div className="opacity-0 group-hover:opacity-100 transition text-xs text-gray-400">
            Explore →
          </div>
        )}
      </div>

      {/* body */}
      <div className="mt-3 text-left">
        <h3 className="text-xl md:text-2xl font-bold leading-tight">
          {title} {highlight && <span className="text-[#14F195]">⚡</span>}
        </h3>

        <p className="mt-2 text-sm text-gray-400 leading-relaxed">{desc}</p>
      </div>

      {/* bottom CTA */}
      <div className="absolute bottom-4 left-6 text-sm text-gray-400 group-hover:text-[#14F195] transition">
        Explore →
      </div>
    </div>
  );
}
