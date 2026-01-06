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
import { Chart } from "react-chartjs-2";

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
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

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

      if (!Array.isArray(data.prices) || data.prices.length === 0) return;

      setRawDates(data.prices.map((p: any) => p[0]));
      setPrices(data.prices.map((p: any) => p[1]));

      // realistic mock volume (until real API)
      setVolumes(
        data.prices.map(() =>
          Math.floor(Math.random() * 700_000 + 300_000)
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

  const priceStats = useMemo(() => {
    if (prices.length < 2) return null;
    const first = prices[0];
    const last = prices[prices.length - 1];
    const changePct = ((last - first) / first) * 100;
    return { last, changePct };
  }, [prices]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading {SYMBOL}…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-14">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-bold">{SYMBOL} Pulse</h1>
            {priceStats && (
              <div className="text-xl mt-1 text-green-400">
                ${priceStats.last.toFixed(4)} (
                {priceStats.changePct.toFixed(2)}%)
              </div>
            )}
          </div>
        </div>

        {/* TIMEFRAMES */}
        <div className="flex gap-2 mb-6">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.days}
              onClick={() => setDays(t.days)}
              className={`px-4 py-1.5 rounded-full text-sm ${
                days === t.days
                  ? "bg-green-400 text-black"
                  : "border border-white/10 text-gray-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* CHART */}
        <div className="rounded-xl border border-white/10 bg-black/50 p-6">
          <div className="h-[420px]">
            <Chart
              type="line"
              data={{
                labels,
                datasets: [
                  {
                    label: "Price",
                    data: prices,
                    borderColor: "#00FFA3",
                    borderWidth: 2.5,
                    tension: 0.35,
                    pointRadius: 0,
                    yAxisID: "price",
                  },
                  {
                    label: "Volume",
                    type: "bar",
                    data: volumes,
                    yAxisID: "volume",
                    backgroundColor: "rgba(0,255,163,0.12)",
                    barPercentage: 1.0,
                    categoryPercentage: 1.0,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: "index",
                  intersect: false,
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: "rgba(0,0,0,0.95)",
                    displayColors: false,
                    callbacks: {
                      title: (items) => {
                        const i = items[0].dataIndex;
                        return new Date(rawDates[i]).toLocaleString();
                      },
                      label: (item) => {
                        const y = item.parsed?.y;
                        if (y === null || y === undefined) return "";

                        if (item.dataset.label === "Volume") {
                          return `Volume: ${Math.round(y).toLocaleString()}`;
                        }

                        return `Price: $${y.toFixed(6)}`;
                      },
                    },
                  },
                },
                scales: {
                  x: { display: false },
                  price: {
                    display: false,
                    position: "right",
                  },
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
          className="mt-6 text-gray-400 underline"
        >
          ← Back to Pulse
        </button>
      </div>
    </div>
  );
}
