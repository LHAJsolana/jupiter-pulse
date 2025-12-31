"use client";

import { useEffect, useState } from "react";

const TOKENS = [
  {
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 2,
  },
  {
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 3,
  },
  {
    symbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 6,
  },
  {
    symbol: "WIF",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    decimals: 2,
  },
];

type Prices = Record<string, number | null>;

export default function Page() {
  const [prices, setPrices] = useState<Prices>({});
  const [loading, setLoading] = useState(true);

  async function fetchPrices() {
    try {
      const ids = TOKENS.map((t) => t.mint).join(",");
      const res = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(
          `https://quote-api.jup.ag/v6/price?ids=${ids}`
        )}`
      );

      const json = await res.json();

      const nextPrices: Prices = {};

      TOKENS.forEach((t) => {
        const price = json?.data?.[t.mint]?.price;
        nextPrices[t.symbol] =
          typeof price === "number"
            ? Number(price.toFixed(t.decimals))
            : null;
      });

      setPrices(nextPrices);
      setLoading(false);
    } catch (err) {
      console.error("Fetch failed:", err);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPrices();
    const i = setInterval(fetchPrices, 8000);
    return () => clearInterval(i);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold flex items-center gap-2 justify-center">
          ⚡ Jupiter Pulse
        </h1>
        <p className="text-gray-400 mt-2">
          Live Solana market pulse · experimental
        </p>
        <div className="text-green-400 mt-2 text-sm">● LIVE</div>
      </div>

      <div className="flex gap-6">
        {TOKENS.map((t) => (
          <div
            key={t.symbol}
            className="w-32 h-20 bg-neutral-900 rounded-xl flex flex-col items-center justify-center shadow"
          >
            <div className="text-xs text-gray-400">{t.symbol}</div>
            <div className="text-lg font-semibold mt-1">
              {loading
                ? "…"
                : prices[t.symbol] !== null
                ? prices[t.symbol]
                : "N/A"}
            </div>
            <div className="w-8 h-1 bg-green-400 rounded-full mt-2" />
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 mt-6">
        Built by @lhajsol · Solana ecosystem
      </div>
    </main>
  );
}
