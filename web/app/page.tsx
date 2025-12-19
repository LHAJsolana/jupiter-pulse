"use client";

import { useEffect, useMemo, useState } from "react";

type Swap = {
  pair: string;
  amount: number;
  route: string;
  impact: string;
};

const initialSwaps: Swap[] = [
  { pair: "SOL → JUP", amount: 42300, route: "Raydium", impact: "0.42%" },
  { pair: "USDC → SOL", amount: 18120, route: "Orca", impact: "0.18%" },
  { pair: "SOL → BONK", amount: 9840, route: "Phoenix", impact: "0.61%" },
  { pair: "JUP → USDC", amount: 27560, route: "Meteora", impact: "0.33%" },
];

const routes = ["Raydium", "Orca", "Phoenix", "Meteora"];
const pairs = ["SOL → JUP", "USDC → SOL", "SOL → BONK", "JUP → USDC"];

function randomSwap(): Swap {
  return {
    pair: pairs[Math.floor(Math.random() * pairs.length)],
    amount: Math.floor(Math.random() * 60000 + 3000),
    route: routes[Math.floor(Math.random() * routes.length)],
    impact: `${(Math.random() * 0.8 + 0.05).toFixed(2)}%`,
  };
}

export default function Home() {
  const [swaps, setSwaps] = useState<Swap[]>(initialSwaps);

  useEffect(() => {
    const interval = setInterval(() => {
      setSwaps((prev) => [randomSwap(), ...prev.slice(0, 12)]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const routeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    swaps.forEach((s) => {
      counts[s.route] = (counts[s.route] || 0) + 1;
    });
    return counts;
  }, [swaps]);

  return (
    <main className="min-h-screen bg-[#0b0f14] text-gray-100">

      {/* ================= HEADER ================= */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/5">
        <span className="text-lg font-semibold tracking-wide">
          Jupiter Pulse
        </span>
        <span className="text-sm text-gray-400">
          Live Solana Flow
        </span>
      </header>

      {/* ================= TITLE ================= */}
      <section className="px-8 py-16 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-green-400 bg-clip-text text-transparent">
          Live Swap Pulse
        </h1>
        <p className="mt-4 text-gray-400">
          Real-time flow & route dominance
        </p>
      </section>

      {/* ================= ROUTE ANALYTICS ================= */}
      <section className="max-w-4xl mx-auto px-6 pb-10">
        <h2 className="text-lg font-semibold mb-4">
          Route Dominance
        </h2>

        <div className="space-y-3">
          {Object.entries(routeStats).map(([route, count]) => (
            <div key={route} className="flex items-center gap-4">
              <span className="w-24 text-sm text-gray-300">
                {route}
              </span>

              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-green-400 transition-all"
                  style={{
                    width: `${(count / swaps.length) * 100}%`,
                  }}
                />
              </div>

              <span className="text-sm text-gray-400 w-6 text-right">
                {count}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PULSE FEED ================= */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="space-y-3">
          {swaps.map((swap, index) => {
            const isWhale = swap.amount > 30000;

            return (
              <div
                key={index}
                className={`flex items-center justify-between px-6 py-4 rounded-xl border animate-fade-in transition ${
                  isWhale
                    ? "bg-purple-500/10 border-purple-500 shadow-lg shadow-purple-500/20"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {swap.pair}
                    {isWhale && <span>🐋</span>}
                  </div>
                  <div className="text-sm text-gray-400">
                    Route: {swap.route} · Impact: {swap.impact}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold">
                    ${swap.amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {isWhale ? "Whale trade" : "just now"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </main>
  );
}
