"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chart } from "react-chartjs-2";
import type { ChartOptions, ChartData } from "chart.js";

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

/* =====================
   SAFE REGISTRATION
===================== */

let chartRegistered = false;
function registerChart() {
  if (!chartRegistered) {
    ChartJS.register(
      LineElement,
      BarElement,
      CategoryScale,
      LinearScale,
      PointElement,
      Tooltip,
      Filler
    );
    chartRegistered = true;
  }
}

/* =====================
   CONSTANTS
===================== */

const TIMEFRAMES = [
  { label: "1D", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

type PricePoint = [number, number];

export default function SymbolPage() {
  registerChart();

  const params = useParams();
  const router = useRouter();

  const symbol = typeof params?.symbol === "string" ? params.symbol : null;
  const SYMBOL = symbol ? symbol.toUpperCase() : "";
  const apiSymbol = symbol ? symbol.toLowerCase() : "";

  const [prices, setPrices] = useState<number[]>([]);
  const [volumes, setVolumes] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [rawDates, setRawDates] = useState<number[]>([]);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);

  /* =====================
     DATA LOADING
  ====================== */

  useEffect(() => {
    if (!apiSymbol) return;
    loadHistory(days);
  }, [apiSymbol, days]);

  async function loadHistory(days: number): Promise<void> {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/prices/history/${apiSymbol}?days=${days}`,
        { cache: "no-store" }
      );

      const data: { prices?: PricePoint[] } = await res.json();
      if (!Array.isArray(data.prices)) return;

      const pricesArr = data.prices.map((p) => p[1]);
      const datesArr = data.prices.map((p) => p[0]);

      setPrices(pricesArr);
      setRawDates(datesArr);

      setVolumes(
        pricesArr.map(
          () => Math.floor(Math.random() * 700_000 + 300_000)
        )
      );

      setLabels(
        datesArr.map((d) =>
          new Date(d).toLocaleDateString("en-US", {
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
     PRICE STATS
  ====================== */

  const priceStats = useMemo(() => {
    if (prices.length < 2) return null;
    const first = prices[0];
    const last = prices[prices.length - 1];
    const changePct = ((last - first) / first) * 100;
    return { last, changePct };
  }, [prices]);

  /* =====================
     SIGNAL
  ====================== */

  const signal = useMemo(() => {
    if (!priceStats) return null;

    if (priceStats.changePct > 5)
      return {
        label: "Bullish Signal",
        color: "text-green-400",
        bg: "bg-green-400/10",
      };

    if (priceStats.changePct < -5)
      return {
        label: "Bearish Signal",
        color: "text-red-400",
        bg: "bg-red-400/10",
      };

    return {
      label: "Neutral Signal",
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    };
  }, [priceStats]);

  /* =====================
     CHART DATA (MIXED)
  ====================== */

  const chartData: ChartData<"bar"> = useMemo(
    () => ({
      labels,
      datasets: [
        {
          type: "bar",
          label: "Volume",
          data: volumes,
          backgroundColor: "rgba(0,255,163,0.12)",
          yAxisID: "volume",
        },
        {
          type: "line",
          label: "Price",
          data: prices,
          borderColor: "#00FFA3",
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 0,
          yAxisID: "price",
        },
      ],
    }),
    [labels, prices, volumes]
  );

  const chartOptions: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(0,0,0,0.9)",
          displayColors: false,
          callbacks: {
            title: (items) => {
              const i = items[0]?.dataIndex;
              if (i == null || rawDates[i] == null) return "";
              return new Date(rawDates[i]).toLocaleString();
            },
            label: (item) => {
              if (item.dataset.label === "Volume") {
                return `Volume: ${Number(item.raw).toLocaleString()}`;
              }
              return `Price: $${Number(item.raw).toFixed(6)}`;
            },
          },
        },
      },
      scales: {
        x: { display: false },
        price: { display: false },
        volume: { display: false, grid: { display: false } },
      },
    }),
    [rawDates]
  );

  if (!symbol || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  /* =====================
     UI
  ====================== */

  return (
    <div className="min-h-screen bg-black text-white px-6 py-14">
      <div className="max-w-6xl mx-auto">
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

          {signal && (
            <div
              className={`px-4 py-2 rounded-full text-sm font-semibold ${signal.bg} ${signal.color}`}
            >
              {signal.label}
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.days}
              onClick={() => setDays(t.days)}
              className={`px-4 py-1.5 rounded-full text-sm transition ${
                days === t.days
                  ? "bg-green-400 text-black"
                  : "border border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/50 p-6 h-[420px]">
          {/* Base type must exist for TS */}
          <Chart type="bar" data={chartData} options={chartOptions} />
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
