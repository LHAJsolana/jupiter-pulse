"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler
);

const TIMEFRAMES = [
  { label: "1D", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export default function SymbolPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();

  const SYMBOL = symbol.toUpperCase();
  const apiSymbol = symbol.toLowerCase();

  const [prices, setPrices] = useState<number[]>([]);
  const [volumes, setVolumes] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [rawDates, setRawDates] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadHistory(days);
  }, [apiSymbol, days]);

  async function loadHistory(days: number) {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/prices/history/${apiSymbol}?days=${days}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      if (!Array.isArray(data.prices) || data.prices.length === 0) {
        setPrices([]);
        return;
      }

      setRawDates(data.prices.map((p: any) => p[0]));
      setPrices(data.prices.map((p: any) => p[1]));

      // 👇 MOCK VOLUME (until you wire real volume)
      setVolumes(
        data.prices.map(() =>
          Math.floor(Math.random() * 1_000_000 + 200_000)
        )
      );

      setLabels(
        data.prices.map((p: any) =>
          new Date(p[0]).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        )
      );
    } finally {
      setLoading(false);
    }
  }

  /* =====================
     PRICE METRICS
  ====================== */

  const priceStats = useMemo(() => {
    if (prices.length < 2) return null;

    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = last - first;
    const changePct = (change / first) * 100;

    return {
      last,
      change,
      changePct,
      positive: changePct >= 0,
    };
  }, [prices]);

  /* =====================
     SIGNAL LOGIC
  ====================== */

  function ma(data: number[], period: number) {
    if (data.length < period) return null;
    return data.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  const signal = useMemo(() => {
    const ma7 = ma(prices, 7);
    const ma25 = ma(prices, 25);

    if (!ma7 || !ma25 || !priceStats) return null;

    if (ma7 > ma25 && priceStats.changePct > 0) {
      return { label: "Bullish Signal", color: "text-green-400", bg: "bg-green-400/10" };
    }

    if (ma7 < ma25 && priceStats.changePct < 0) {
      return { label: "Bearish Signal", color: "text-red-400", bg: "bg-red-400/10" };
    }

    return { label: "Neutral Signal", color: "text-yellow-400", bg: "bg-yellow-400/10" };
  }, [prices, priceStats]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 animate-pulse">
        Loading {SYMBOL} pulse…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white px-6 py-14">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-extrabold mb-2">{SYMBOL} Pulse</h1>

            {priceStats && (
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-bold">
                  ${priceStats.last.toFixed(4)}
                </span>

                <span
                  className={`text-lg font-semibold ${
                    priceStats.positive ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {priceStats.positive ? "+" : ""}
                  {priceStats.changePct.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {signal && (
            <div className={`px-4 py-2 rounded-full text-sm font-semibold ${signal.bg} ${signal.color}`}>
              {signal.label}
            </div>
          )}
        </div>

        {/* TIMEFRAMES */}
        <div className="flex gap-2 mb-6">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.days}
              onClick={() => setDays(t.days)}
              className={`px-4 py-1.5 rounded-full text-sm border transition ${
                days === t.days
                  ? "bg-green-400 text-black border-green-400"
                  : "border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* CHART */}
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-6 shadow-xl">
          <div className="h-[420px]">
            <Line
              data={{
                labels,
                datasets: [
                  {
                    type: "line",
                    data: prices,
                    borderColor: "#00FFA3",
                    borderWidth: 2.5,
                    tension: 0.35,
                    pointRadius: 0,
                    yAxisID: "price",
                  },
                  {
                    type: "bar",
                    data: volumes,
                    backgroundColor: "rgba(0,255,163,0.15)",
                    yAxisID: "volume",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: "rgba(0,0,0,0.95)",
                    displayColors: false,
                    callbacks: {
                      title: (ctx) => {
                        const i = ctx[0].dataIndex;
                        return new Date(rawDates[i]).toLocaleString();
                      },
                      label: (ctx) => {
                        if (ctx.dataset.type === "bar") {
                          return `Volume: ${ctx.parsed.y.toLocaleString()}`;
                        }
                        return `Price: $${ctx.parsed.y.toFixed(6)}`;
                      },
                    },
                  },
                },
                scales: {
                  x: { display: false },
                  price: { display: false },
                  volume: {
                    display: false,
                    grid: { display: false },
                  },
                },
              }}
            />
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="mt-8 text-gray-400 hover:text-white underline"
        >
          ← Back to Pulse
        </button>
      </div>
    </div>
  );
}
