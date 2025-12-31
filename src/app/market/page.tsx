"use client";

import { useEffect, useState } from "react";

export default function Market() {
  const [coins, setCoins] = useState<any[]>([]);
  const [charts, setCharts] = useState<Record<string,string>>({});

  useEffect(() => {
    loadMarket();
  }, []);

  async function loadMarket() {
    try {
      const res = await fetch("/api/market");
      const data = await res.json();
      setCoins(data);

      // fetch sparkline for each coin after market loads
      data.forEach((c: any) => loadChart(c.symbol));
    } catch (e) {
      console.log("❌ MARKET ERROR:", e);
    }
  }

  async function loadChart(symbol: string) {
    try {
      const res = await fetch(`/api/prices/history/${symbol}?days=7`);
      const data = await res.json();

      if (!data.prices?.length) return;

      // extract only price points
      const prices = data.prices.map((p: any) => p[1]).slice(-60);

      const chartUrl = `https://quickchart.io/chart?c={
        type:'sparkline',
        data:{datasets:[{data:[${prices}]}]},
        options:{elements:{line:{borderColor:'#00ffae'}}}
      }`;

      setCharts(prev => ({ ...prev, [symbol]: chartUrl }));
    } catch (e) {
      console.log("❌ SPARKLINE ERROR:", symbol, e);
    }
  }

  return (
    <div className="px-8 py-12 text-white max-w-5xl mx-auto">

      <h1 className="text-3xl font-bold mb-8">Market Overview 🔥</h1>

      {coins.length === 0 && <p className="text-gray-400">Loading...</p>}

      <div className="space-y-3">
        {coins.map((c) => (
          <div
            key={c.symbol}
            className="bg-neutral-900 p-4 rounded-lg flex justify-between items-center hover:bg-neutral-800 transition"
          >
            <div>
              <p className="uppercase font-bold">{c.symbol}</p>
              <p className={`text-sm ${c.change24h > 0 ? "text-green-400" : "text-red-400"}`}>
                {c.change24h.toFixed(2)}%
              </p>
            </div>

            <p className="font-semibold text-lg">${c.price.toLocaleString()}</p>

            {/* Chart — appear when ready */}
            {charts[c.symbol] ? (
              <img src={charts[c.symbol]} className="w-28 opacity-90" />
            ) : (
              <p className="text-gray-400 text-sm">Loading...</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
