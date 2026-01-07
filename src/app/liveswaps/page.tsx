"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Token = "ALL" | "SOL" | "JUP" | "JTO" | "PYTH";

type Swap = {
  pair: string;
  route: string;
  impact: number;
  amountUsd: number;
  whale?: boolean;
  time: string;
  token: Token;
};

type RouteStat = {
  route: string;
  score: number;
};

type Alert = {
  id: string;
  message: string;
};

const ROUTES = ["Meteora", "Raydium", "Orca", "Phoenix"];
const TOKENS: Token[] = ["ALL", "SOL", "JUP", "JTO", "PYTH"];

const PAIRS_BY_TOKEN: Record<Token, string[]> = {
  ALL: ["USDC → SOL", "SOL → JUP", "JUP → USDC", "SOL → JTO", "JTO → SOL", "SOL → PYTH"],
  SOL: ["USDC → SOL", "SOL → JUP", "SOL → JTO", "SOL → PYTH"],
  JUP: ["SOL → JUP", "JUP → USDC"],
  JTO: ["SOL → JTO", "JTO → SOL"],
  PYTH: ["SOL → PYTH"],
};

function randomSwap(token: Token): Swap {
  const amountUsd = Math.random() * 120_000 + 5_000;
  const impact = Math.random() * 0.8 + 0.1;
  const whale = amountUsd > 70_000;

  const effectiveToken =
    token === "ALL"
      ? TOKENS[Math.floor(Math.random() * (TOKENS.length - 1)) + 1]
      : token;

  const pairs = PAIRS_BY_TOKEN[effectiveToken];

  return {
    pair: pairs[Math.floor(Math.random() * pairs.length)],
    route: ROUTES[Math.floor(Math.random() * ROUTES.length)],
    impact,
    amountUsd,
    whale,
    time: "just now",
    token: effectiveToken,
  };
}

function formatUsd(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function LiveSwapsPage() {
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [live, setLive] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tokenFilter, setTokenFilter] = useState<Token>("ALL");
  const prevScores = useRef<Record<string, number>>({});

  /* =====================
     AUTO FEED (FILTERED)
  ====================== */

  useEffect(() => {
    if (!live) return;

    const interval = setInterval(() => {
      const next = randomSwap(tokenFilter);

      setSwaps((prev) => [next, ...prev].slice(0, 8));

      if (next.whale) {
        pushAlert(`🐳 Whale ${next.token} swap · ${formatUsd(next.amountUsd)}`);
      }
    }, 3200);

    return () => clearInterval(interval);
  }, [live, tokenFilter]);

  /* =====================
     FILTERED SWAPS
  ====================== */

  const visibleSwaps = useMemo(() => {
    if (tokenFilter === "ALL") return swaps;
    return swaps.filter((s) => s.token === tokenFilter);
  }, [swaps, tokenFilter]);

  /* =====================
     PULSE SCORE
  ====================== */

  const routeScores = useMemo<RouteStat[]>(() => {
    const base: Record<string, number> = {};
    ROUTES.forEach((r) => (base[r] = 0));

    visibleSwaps.forEach((s, i) => {
      let weight = 10;

      weight *= Math.max(0.4, 1 - i * 0.15);
      if (s.whale) weight += 20;
      weight += s.impact * 15;

      base[s.route] += weight;
    });

    const computed = Object.entries(base).map(([route, score]) => ({
      route,
      score: Math.min(100, Math.round(score)),
    }));

    computed.forEach((r) => {
      const prev = prevScores.current[r.route] ?? 0;
      if (r.score - prev >= 25) {
        pushAlert(`📈 Pulse spike on ${r.route}`);
      }
      prevScores.current[r.route] = r.score;
    });

    return computed.sort((a, b) => b.score - a.score);
  }, [visibleSwaps]);

  /* =====================
     ALERT HANDLER
  ====================== */

  function pushAlert(message: string) {
    const id = Math.random().toString(36).slice(2);
    setAlerts((prev) => [...prev, { id, message }]);

    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 6000);
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-14 relative">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Live Swap Pulse
            </h1>
            <p className="text-gray-400 mt-2">
              Jupiter ecosystem flow intelligence
            </p>
          </div>

          <button
            onClick={() => setLive((v) => !v)}
            className={`text-sm px-3 py-1 rounded-full border transition ${
              live
                ? "border-green-400 text-green-400"
                : "border-white/20 text-gray-400"
            }`}
          >
            {live ? "LIVE" : "PAUSED"}
          </button>
        </div>

        {/* TOKEN FILTER */}
        <div className="flex gap-2 mb-12 flex-wrap">
          {TOKENS.map((t) => (
            <button
              key={t}
              onClick={() => setTokenFilter(t)}
              className={`px-4 py-1.5 rounded-full text-sm transition ${
                tokenFilter === t
                  ? "bg-green-400 text-black"
                  : "border border-white/20 text-gray-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* PULSE SCORE */}
        <div className="mb-16">
          <h2 className="text-lg font-semibold mb-6">
            Route Pulse Score
          </h2>

          <div className="space-y-4">
            {routeScores.map((r, i) => (
              <div key={r.route}>
                <div className="flex justify-between text-sm mb-1 text-gray-400">
                  <span>{i === 0 && "👑 "} {r.route}</span>
                  <span>{r.score}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-400 via-green-400 to-[#14F195]"
                    style={{ width: `${r.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LIVE FEED */}
        <div className="space-y-5">
          {visibleSwaps.map((s, i) => (
            <div
              key={i}
              className={`relative rounded-2xl border p-5 flex justify-between items-center transition-all
                ${
                  s.whale
                    ? "border-purple-400/40 bg-purple-500/10 animate-pulse-soft"
                    : "border-white/10 bg-black/40 hover:bg-white/[0.03]"
                }
              `}
            >
              <div>
                <div className="font-semibold text-lg">
                  {s.pair}
                </div>
                <div className="text-sm text-gray-400">
                  {s.token} · {s.route} · Impact {s.impact.toFixed(2)}%
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold text-lg">
                  {formatUsd(s.amountUsd)}
                </div>
                <div className="text-xs text-gray-500">
                  {s.time}
                </div>
              </div>

              {s.whale && (
                <div className="absolute -top-2 -right-2 text-xs px-2 py-0.5 rounded-full bg-purple-500 text-white shadow-lg">
                  🐳 Whale
                </div>
              )}
            </div>
          ))}

          {visibleSwaps.length === 0 && (
            <div className="text-gray-500 text-center py-20">
              No swaps for this token yet
            </div>
          )}
        </div>

        {/* BACK */}
        <Link
          href="/"
          className="inline-block mt-14 text-gray-400 underline hover:text-white transition"
        >
          ← Back to Market
        </Link>
      </div>

      {/* ALERT STACK */}
      <div className="fixed top-6 right-6 space-y-3 z-50">
        {alerts.map((a) => (
          <div
            key={a.id}
            className="px-4 py-3 rounded-xl bg-black border border-white/20 shadow-lg animate-alert"
          >
            {a.message}
          </div>
        ))}
      </div>

      {/* ANIMATIONS */}
      <style jsx>{`
        .animate-pulse-soft {
          animation: pulseSoft 2.5s ease-in-out infinite;
        }
        @keyframes pulseSoft {
          0%, 100% { box-shadow: 0 0 0 0 rgba(168,85,247,0.35); }
          50% { box-shadow: 0 0 25px 6px rgba(168,85,247,0.45); }
        }
        .animate-alert {
          animation: alertIn 0.35s ease-out;
        }
        @keyframes alertIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
