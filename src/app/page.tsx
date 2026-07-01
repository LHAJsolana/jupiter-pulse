import Image from "next/image";
import Link from "next/link";

type CardItem = {
  href: string;
  title: string;
  desc: string;
  icon: string;
  badge?: string;
  accent?: "green" | "yellow" | "red" | "default";
};

const cards: CardItem[] = [
  {
    href: "/pulse",
    title: "Live Prices",
    desc: "Auto-refreshing token prices with fallback protection.",
    icon: "$",
    accent: "green",
  },
  {
    href: "/liveswaps",
    title: "Live Swap Pulse",
    desc: "Real-time whale swaps and route dominance across Jupiter.",
    icon: "~",
    badge: "LIVE",
    accent: "green",
  },
  {
    href: "/signals",
    title: "Market Signals",
    desc: "Market-derived momentum, risk, and confidence signals.",
    icon: "^",
    accent: "default",
  },
  {
    href: "/missed-money",
    title: "Missed Money",
    desc: "Find value leaks: routing, limits, borrow fees, idle capital.",
    icon: "%",
    badge: "PHASE 2",
    accent: "yellow",
  },
  {
    href: "/wallet-review",
    title: "Wallet Review",
    desc: "PnL, win-rate, holds, and behavioral breakdown from swaps.",
    icon: "#",
    badge: "NEW",
    accent: "default",
  },
  {
    href: "/wallet-compare",
    title: "Wallet Compare",
    desc: "Compare wallets across PnL, exits, frequency, and holds.",
    icon: "=",
    badge: "NEW",
    accent: "default",
  },
  {
    href: "/alerts",
    title: "Watchlist",
    desc: "Follow tokens, wallets, thresholds, and large-swap alerts.",
    icon: "!",
    accent: "yellow",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#080c14] to-black text-white">
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          Jupiter Pulse <span className="text-yellow-400">⚡</span>
        </h1>

        <Link href="/pulse" className="text-sm text-gray-300 hover:text-[#14F195] transition">
          Enter App &rarr;
        </Link>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 pb-10">
        <section className="pt-8 pb-4 text-center">
          <h2 className="text-4xl md:text-5xl xl:text-6xl font-extrabold leading-tight">
            Paste a Solana wallet.
            <br />
            Understand <span className="text-[#14F195]">how it trades.</span>
          </h2>

          <p className="mt-4 text-gray-400 text-base md:text-lg max-w-3xl mx-auto">
            An explainable behavior report built from wallet swaps: realized outcomes,
            execution habits, evidence, confidence, and honest limitations.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/wallet-review"
              className="rounded-xl bg-[#14F195] px-5 py-3 text-sm font-extrabold text-black hover:bg-[#35f5a6] transition"
            >
              Review a wallet &rarr;
            </Link>
            <Link
              href="/pulse"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 hover:bg-white/10 transition"
            >
              Explore markets
            </Link>
          </div>
        </section>

        <section className="py-3 flex flex-col items-center gap-2">
          <p className="text-gray-500 uppercase tracking-widest text-xs">Built on</p>
          <div className="flex items-center gap-10 opacity-90">
            <Image src="/solana.svg" alt="Solana" width={84} height={28} />
            <Image src="/jupiter.svg" alt="Jupiter" width={84} height={28} />
          </div>
        </section>

        <section className="pt-5 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cards.map((card) => (
              <Link key={card.href} href={card.href} className="group">
                <Card {...card} />
              </Link>
            ))}
          </div>
        </section>

        <footer className="pt-2 pb-6 text-gray-500 text-sm text-center">
          Built by{" "}
          <a
            href="https://x.com/lhajsol"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-semibold hover:text-[#00FFA3] transition"
          >
            @lhajsol
          </a>{" "}
          - Powered by Jupiter & Solana
        </footer>
      </main>
    </div>
  );
}

function Card({
  title,
  desc,
  icon,
  badge,
  accent = "default",
}: {
  title: string;
  desc: string;
  icon: string;
  badge?: string;
  accent?: "green" | "yellow" | "red" | "default";
}) {
  const accentBorder =
    accent === "green"
      ? "border-[#14F195]/35 hover:border-[#14F195]/60"
      : accent === "yellow"
        ? "border-yellow-400/30 hover:border-yellow-400/55"
        : accent === "red"
          ? "border-red-400/30 hover:border-red-400/55"
          : "border-white/10 hover:border-white/25";

  const accentGlow =
    accent === "green"
      ? "hover:shadow-[0_0_55px_rgba(20,241,149,0.16)]"
      : accent === "yellow"
        ? "hover:shadow-[0_0_55px_rgba(250,204,21,0.14)]"
        : accent === "red"
          ? "hover:shadow-[0_0_55px_rgba(248,113,113,0.14)]"
          : "hover:shadow-[0_0_55px_rgba(255,255,255,0.06)]";

  return (
    <div
      className={[
        "relative h-full min-h-[178px] rounded-xl border p-5",
        "bg-black/45 backdrop-blur overflow-hidden",
        "transition-all duration-300 hover:-translate-y-0.5",
        accentBorder,
        accentGlow,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#14F195] font-black text-lg">
          {icon}
        </div>

        {badge && (
          <div className="text-[10px] tracking-widest font-bold px-2 py-1 rounded-full border border-white/10 bg-white/5 text-gray-200 whitespace-nowrap">
            {badge}
          </div>
        )}
      </div>

      <div className="mt-4 text-left">
        <h3 className="text-lg font-extrabold leading-tight">{title}</h3>
        <p className="mt-2 text-sm text-gray-400 leading-snug">{desc}</p>

        <div className="mt-4 text-sm text-gray-400 group-hover:text-[#14F195] transition">
          Open &rarr;
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition">
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
      </div>
    </div>
  );
}
