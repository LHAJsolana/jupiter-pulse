"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Token = {
  symbol: string;
  price: number;
  change: number;
};

function formatPrice(price: number) {
  if (price >= 100) return `$${price.toFixed(2)}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.01) return `$${price.toFixed(6)}`;
  return `$${price.toPrecision(4)}`;
}

function formatChange(change: number) {
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

export default function PulsePage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadPrices() {
      try {
        setLoading(true);
        setError(false);

        const res = await fetch("/api/prices", { cache: "no-store" });
        const data = await res.json();

        if (!Array.isArray(data)) {
          setError(true);
          return;
        }

        setTokens(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadPrices();
  }, []);

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
    <div className="min-h-screen px-6 py-16 max-w-6xl mx-auto">
      <h1 className="text-4xl font-extrabold mb-2">Jupiter Pulse ⚡</h1>
      <p className="text-gray-400 mb-8">
        Real-time momentum across Solana markets
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tokens.map((t) => (
          <Link
            key={t.symbol}
            href={`/pulse/${t.symbol}`}
            className="p-6 rounded-2xl border border-white/10 bg-[var(--bg)] hover:border-[#00FFA3]/40 transition"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl font-bold">{t.symbol}</span>
              <span
                className={
                  t.change >= 0 ? "text-green-400" : "text-red-400"
                }
              >
                {formatChange(t.change)}
              </span>
            </div>

            <div className="text-2xl font-semibold">
              {formatPrice(t.price)}
            </div>

            <div className="mt-2 text-sm text-gray-400">
              View pulse →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
