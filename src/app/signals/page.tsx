"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Risk = {
  score: number;
  level: "Low" | "Medium" | "High";
  factors: string[];
};

type Signal = {
  id: string;
  symbol: string;
  price: number | null;
  change24h: number | null;
  type: string;
  message: string;
  score: number;
  bias: "Bullish" | "Bearish" | "Neutral";
  confidence: number;
  risk: Risk;
  time: string;
};

function biasClass(bias: Signal["bias"]) {
  if (bias === "Bullish") return "text-green-300";
  if (bias === "Bearish") return "text-red-300";
  return "text-white/70";
}

function formatPrice(price: number | null) {
  if (price === null || !Number.isFinite(price)) return "n/a";
  if (price >= 100) return `$${price.toFixed(2)}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.01) return `$${price.toFixed(6)}`;
  return `$${price.toPrecision(4)}`;
}

function formatChange(change: number | null) {
  if (change === null || !Number.isFinite(change)) return "n/a";
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | "Bullish" | "Bearish" | "Neutral">("All");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadSignals() {
    try {
      setError(null);
      const res = await fetch("/api/signals", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load signals");
      setSignals(Array.isArray(json) ? json : []);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load signals");
      setSignals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSignals();
    const id = window.setInterval(loadSignals, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const visible = useMemo(() => {
    if (filter === "All") return signals;
    return signals.filter((s) => s.bias === filter);
  }, [signals, filter]);

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-white/45">
              <Link href="/" className="hover:text-white">Home</Link> / Signals
            </div>
            <h1 className="mt-3 text-4xl font-extrabold">Live Signals</h1>
            <p className="mt-2 text-sm text-white/55 max-w-2xl">
              Market-derived signals from live price movement plus the current risk engine.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSignals}
            className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {(["All", "Bullish", "Bearish", "Neutral"] as const).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setFilter(x)}
                className={[
                  "px-3 py-1.5 rounded-full border text-sm transition",
                  filter === x
                    ? "border-green-400/40 bg-green-400/10 text-green-100"
                    : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10",
                ].join(" ")}
              >
                {x}
              </button>
            ))}
          </div>
          <div className="text-xs text-white/40">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for data"}
          </div>
        </div>

        {loading && <div className="mt-10 text-white/50 animate-pulse">Loading signals...</div>}

        {error && !loading && (
          <div className="mt-10 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {visible.map((s) => (
              <Link
                key={s.id}
                href={`/pulse/${s.symbol}`}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:border-green-400/30 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-extrabold">{s.symbol}</div>
                      <span className={["text-sm font-semibold", biasClass(s.bias)].join(" ")}>
                        {s.bias}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-white/55">
                      {formatPrice(s.price)} / {formatChange(s.change24h)} 24h
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold">{s.confidence}</div>
                    <div className="text-xs text-white/45">confidence</div>
                  </div>
                </div>

                <div className="mt-4 text-sm font-bold">{s.type}</div>
                <p className="mt-1 text-sm text-white/65">{s.message}</p>

                <div className="mt-4 flex items-center justify-between text-xs text-white/50">
                  <span>Pulse {s.score}/100</span>
                  <span>Risk {s.risk.level} ({s.risk.score})</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-green-300" style={{ width: `${s.confidence}%` }} />
                </div>
              </Link>
            ))}

            {visible.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/55">
                No signals match this filter right now.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
