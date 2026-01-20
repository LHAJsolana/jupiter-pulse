"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

type Token = {
  symbol: string;
  price: number;
  change: number;
};

type SortMode = "pulse" | "change" | "price";

function formatPrice(price: number) {
  if (price >= 100) return `$${price.toFixed(2)}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.01) return `$${price.toFixed(6)}`;
  return `$${price.toPrecision(4)}`;
}

function formatChange(change: number) {
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

// Pulse Score from 24h change
function getPulseScore(change: number) {
  const score = Math.max(0, Math.min(100, Math.round(50 + change * 2)));

  if (score >= 70)
    return { score, label: "Hot", color: "bg-red-500 text-white" };
  if (score >= 50)
    return { score, label: "Strong", color: "bg-green-400 text-black" };
  if (score >= 30)
    return { score, label: "Neutral", color: "bg-gray-400 text-black" };
  return { score, label: "Weak", color: "bg-red-900 text-white" };
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const chartData = {
    labels: data.map((_, i) => i),
    datasets: [
      {
        data,
        borderColor: positive ? "#00FFA3" : "#FF4D4F",
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { display: false }, y: { display: false } },
  } as const;

  return (
    <div className="h-12 mt-3">
      <Line data={chartData} options={options} />
    </div>
  );
}

export default function PulsePage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [historyMap, setHistoryMap] = useState<Record<string, number[]>>({});
  const [sortMode, setSortMode] = useState<SortMode>("pulse");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pulse-sort");
    if (saved === "pulse" || saved === "change" || saved === "price") {
      setSortMode(saved);
    }
  }, learnOnceGuard());

  useEffect(() => {
    localStorage.setItem("pulse-sort", sortMode);
  }, [sortMode]);

  async function loadPrices() {
    try {
      setError(false);

      const res = await fetch("/api/prices", { cache: "no-store" });
      const data = await res.json();

      if (!Array.isArray(data)) {
        setError(true);
        return;
      }

      setTokens(data);
      setLastUpdated(new Date());

      const map: Record<string, number[]> = {};
      data.forEach((t: Token) => {
        const raw = localStorage.getItem(`history-${t.symbol}`);
        if (!raw) return;

        try {
          const parsed = JSON.parse(raw);
          // expecting [[ts, price], ...]
          const pricesOnly = Array.isArray(parsed)
            ? parsed.map((p: any) => p?.[1]).filter((v: any) => typeof v === "number")
            : [];
          if (pricesOnly.length) map[t.symbol] = pricesOnly;
        } catch {
          // ignore
        }
      });

      setHistoryMap(map);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrices();
    const interval = setInterval(loadPrices, 30000);
    return () => clearInterval(interval);
  }, learnOnceGuard());

  const losers = useMemo(() => {
    return [...tokens]
      .filter((t) => t.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 3);
  }, [tokens]);

  const sortedTokens = useMemo(() => {
    const copy = [...tokens];
    if (sortMode === "change") return copy.sort((a, b) => b.change - a.change);
    if (sortMode === "price") return copy.sort((a, b) => b.price - a.price);

    return copy.sort(
      (a, b) => getPulseScore(b.change).score - getPulseScore(a.change).score
    );
  }, [tokens, sortMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 animate-pulse">
        Loading Jupiter Pulse…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        ✕ Failed to load Pulse data
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-gray-300 hover:text-white transition"
            >
              ← Home
            </Link>
            <span className="text-gray-600">/</span>
            <div className="font-extrabold tracking-tight">
              Jupiter Pulse <span className="text-[var(--accent)]">⚡</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/signals"
              className="text-sm px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              Signals
            </Link>
            <Link
              href="/liveswaps"
              className="text-sm px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              Live Swaps
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-10 pb-16">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold">Market Pulse</h1>
            <p className="text-gray-400 mt-2">
              Real-time momentum across Solana markets
              {lastUpdated && (
                <span className="ml-2 text-xs text-gray-500">
                  · updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-green-400 mt-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>
        </div>

        {/* Sorting */}
        <div className="flex flex-wrap gap-2 mt-6 mb-8">
          {[
            { key: "pulse", label: "🔥 Pulse" },
            { key: "change", label: "📈 Change" },
            { key: "price", label: "💰 Price" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSortMode(s.key as SortMode)}
              className={[
                "px-4 py-2 rounded-full text-sm font-semibold transition border",
                sortMode === s.key
                  ? "bg-[var(--accent)] text-black border-transparent"
                  : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10",
              ].join(" ")}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Top Losers */}
        {losers.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-red-400">
                🔴 Top Losers
              </h2>
              <span className="text-xs text-gray-500">24h change</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {losers.map((t) => (
                <Link
                  key={`loser-${t.symbol}`}
                  href={`/pulse/${t.symbol}`}
                  className="p-6 rounded-2xl border border-red-500/35 bg-white/5 hover:border-red-500/60 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="text-xl font-extrabold">{t.symbol}</div>
                    <div className="text-xs text-red-300 font-semibold">
                      {formatChange(t.change)}
                    </div>
                  </div>

                  <div className="text-2xl font-semibold mt-2">
                    {formatPrice(t.price)}
                  </div>

                  {historyMap[t.symbol] && (
                    <Sparkline data={historyMap[t.symbol]} positive={false} />
                  )}

                  <div className="mt-2 text-sm text-gray-400">
                    View pulse →
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All tokens */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sortedTokens.map((t) => {
            const pulse = getPulseScore(t.change);

            return (
              <Link
                key={t.symbol}
                href={`/pulse/${t.symbol}`}
                className="relative p-6 rounded-2xl border border-white/10 bg-white/5 hover:border-[var(--accent)]/40 transition group"
              >
                {/* Pulse badge + tooltip */}
                <div className="absolute top-3 right-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-bold cursor-help ${pulse.color}`}
                  >
                    {pulse.label} · {pulse.score}
                  </span>

                  <div className="absolute right-0 mt-2 w-56 p-3 rounded-lg bg-black border border-white/10 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                    <strong className="text-white">Pulse Score</strong>
                    <p className="mt-1">
                      A 0–100 momentum score based on 24h price change.
                    </p>
                    <p className="mt-1">Higher = stronger short-term trend.</p>
                  </div>
                </div>

                <div className="text-xl font-extrabold">{t.symbol}</div>

                <div className="text-2xl font-semibold mt-2">
                  {formatPrice(t.price)}
                </div>

                <div
                  className={[
                    "text-sm font-semibold mt-1",
                    t.change >= 0 ? "text-green-400" : "text-red-400",
                  ].join(" ")}
                >
                  {formatChange(t.change)}
                </div>

                {historyMap[t.symbol] && (
                  <Sparkline data={historyMap[t.symbol]} positive={t.change >= 0} />
                )}

                <div className="mt-2 text-sm text-gray-400 group-hover:text-[var(--accent)] transition">
                  View pulse →
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Small helper so React doesn't warn about useEffect deps in copy/paste contexts.
 * Returns a stable empty deps array.
 */
function learnOnceGuard(): [] {
  return [];
}
