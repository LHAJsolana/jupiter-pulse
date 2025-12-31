"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PulsePage() {
  const [prices, setPrices] = useState<any[] | null>(null);
  const [lastValidPrices, setLastValidPrices] = useState<any[] | null>(null);
  const [theme, setTheme] = useState("solana");
  const [updating, setUpdating] = useState(false);

  // Load Theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "solana";
    setTheme(saved);
  }, []);

  // Toggle UI Theme
  function toggleTheme(next: string) {
    setTheme(next);
    localStorage.setItem("theme", next);
  }

  // ---------------- 🔥 Fetch Live Prices ----------------
  async function loadPrices() {
    setUpdating(true);
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setPrices(data);
        setLastValidPrices(data);
      } else if (lastValidPrices) setPrices(lastValidPrices);
    } catch {
      if (lastValidPrices) setPrices(lastValidPrices);
    }
    setUpdating(false);
  }

  useEffect(() => {
    loadPrices();
    const int = setInterval(loadPrices, 10000);
    return () => clearInterval(int);
  }, []);

  const getColor = (v: number) => (v >= 0 ? "text-green-400" : "text-red-400");

  // First load screen
  if (!prices)
    return (
      <div className="text-center mt-40 text-lg animate-pulse text-gray-300">
        Fetching market data...
        <p className="text-sm mt-2 opacity-60">
          Powered by Jupiter • CoinGecko API • Solana ⚡
        </p>
      </div>
    );

  return (
    <div className={`${theme === "solana" ? "solana-theme" : "jupiter-theme"} min-h-screen transition-all`}>

      {/* Toggle Mode Buttons */}
      <div className="flex justify-end gap-3 p-5">
        <button
          onClick={() => toggleTheme("solana")}
          className="px-4 py-2 bg-[#00FFA3] text-black rounded-full font-bold hover:opacity-80 transition"
        >
          Solana Mode
        </button>

        <button
          onClick={() => toggleTheme("jupiter")}
          className="px-4 py-2 bg-[#ff7a00] text-black rounded-full font-bold hover:opacity-80 transition"
        >
          Jupiter Mode
        </button>
      </div>

      <div className="px-6 py-12">

        {/* Title */}
        <h1 className="text-4xl font-bold text-center mb-2 flex justify-center gap-2">
          📊 Jupiter Pulse Dashboard
        </h1>

        <p className="text-center text-gray-400 mb-10">
          Live prices • Auto-update every 10s
          {updating && <span className="text-yellow-400 ml-2 animate-pulse">Updating...</span>}
        </p>

        {/* Token Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">

          {prices.map((t) => (
            <div key={t.symbol}
              className={`
                p-6 rounded-xl shadow-lg text-center border hover:scale-[1.03] transition-all
                bg-[var(--bg)] border-[var(--primary)]
              `}
            >
              <h2 className="text-xl font-bold mb-2">{t.symbol || "??"}</h2>

              {/* Dynamic BONK precision */}
              <p className="text-2xl font-bold text-green-400">
                ${t?.price
                  ? (t.price < 0.01 ? t.price.toFixed(6) : t.price.toFixed(4))
                  : "0.000000"}
              </p>

              <p className={`mt-1 font-semibold ${getColor(t?.change ?? 0)}`}>
                {t?.change ? t.change.toFixed(2) + "%" : "0.00%"}
              </p>

              <Link href={`/pulse/${(t.symbol || "").toLowerCase()}`}>
                <button
                  className="
                    mt-3 px-4 py-2 rounded-lg font-semibold w-full
                    bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]
                    text-black hover:opacity-90 transition
                  "
                >
                  View Chart
                </button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-500 mt-12">
          Powered by Jupiter • CoinGecko API • Built on Solana ⚡
        </p>
      </div>
    </div>
  );
}
