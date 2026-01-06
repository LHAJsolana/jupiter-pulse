"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Coin = {
  symbol: string;
  price: number | null;
  change24h: number | null;
};

function getSignal(change?: number | null) {
  if (typeof change !== "number") return "No data";
  if (change >= 3) return "🚀 Building Momentum";
  if (change <= -3) return "⚠️ Weakening";
  return "— Neutral";
}

export default function MarketSignalsPage() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadMarket();
  }, []);

  async function loadMarket() {
    try {
      setError(false);
      const res = await fetch("/api/market", { cache: "no-store" });
      const data = await res.json();

      // 🔥 HARD GUARD (THIS FIXES THE CRASH)
      if (!Array.isArray(data)) {
        console.error("Market API invalid response:", data);
        setError(true);
        setCoins([]);
        return;
      }

      setCoins(data);
    } catch (e) {
      console.error("Market load error:", e);
      setError(true);
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }

  const signals = useMemo(() => {
    return coins.map((c) => ({
      ...c,
      signal: getSignal(c.change24h),
    }));
  }, [coins]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 animate-pulse">
        Loading Market Signals…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        ✕ Failed to load Market Signals
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-16 max-w-5xl mx-auto text-white">
      <h1 className="text-4xl font-extrabold mb-2">
        📡 Market Signals
      </h1>
      <p className="text-gray-400 mb-8">
        Momentum & trend insights — click to deep dive
      </p>

      <div className="space-y-3">
        {signals.map((c) => (
          <Link
            key={c.symbol}
            href={`/pulse/${c.symbol}`}
            className="block p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#00FFA3]/40 transition"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-lg">
                  {c.symbol}
                </div>
                <div className="text-sm text-gray-400">
                  {c.signal}
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold">
                  {typeof c.price === "number"
                    ? `$${c.price.toLocaleString()}`
                    : "—"}
                </div>
                <div
                  className={`text-sm ${
                    typeof c.change24h === "number"
                      ? c.change24h >= 0
                        ? "text-green-400"
                        : "text-red-400"
                      : "text-gray-500"
                  }`}
                >
                  {typeof c.change24h === "number"
                    ? `${c.change24h >= 0 ? "+" : ""}${c.change24h.toFixed(
                        2
                      )}%`
                    : "—"}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
