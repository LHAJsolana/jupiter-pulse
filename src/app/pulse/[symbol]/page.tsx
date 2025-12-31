"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Line } from "react-chartjs-2";

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

export default function SymbolPage() {
  const { symbol } = useParams() as { symbol: string };
  const router = useRouter();

  const [history, setHistory] = useState<any[] | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory(d = days) {
    try {
      setLoading(true);
      const res = await fetch(`/api/prices/history/${symbol}?days=${d}`, { cache: "no-store" });
      const data = await res.json();

      if (!data?.prices) {
        setError("No price history data available.");
        setLoading(false);
        return;
      }

      setHistory(data.prices);
      setError(null);
      setLoading(false);

      // ⭐ Save last chart history so dashboard can reuse it
      localStorage.setItem(`history-${symbol}`, JSON.stringify(data.prices));

    } catch (err) {
      console.log("History fetch error:", err);
      setError("Unable to load chart");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    const interval = setInterval(() => loadHistory(days), 25000); // auto refresh
    return () => clearInterval(interval);
  }, [days, symbol]);

  if (error) return (
    <div className="text-red-400 text-center pt-40">
      ❌ {error}
      <br />
      <button
        onClick={() => router.back()}
        className="mt-4 underline"
      >
        Go Back
      </button>
    </div>
  );

  if (!history || loading) return (
    <div className="text-gray-300 text-center pt-40 text-xl animate-pulse">
      Loading {symbol.toUpperCase()} chart...
    </div>
  );

  const chartData = {
    labels: history.map((p: any) => new Date(p[0]).toLocaleDateString()),
    datasets: [{
      label: `${symbol.toUpperCase()} Price`,
      data: history.map((p: any) => p[1]),
      borderColor: "var(--accent)",
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 0,
      fill: true,
      backgroundColor: (ctx: any) => {
        const { ctx: c, chartArea } = ctx.chart;
        if (!chartArea) return null;
        const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, "var(--accent-transparent)");
        gradient.addColorStop(1, "transparent");
        return gradient;
      }
    }]
  };

  return (
    <div className="text-white px-6 py-12">

      <div className="flex justify-between items-center max-w-5xl mx-auto mb-8">
        <button
          onClick={() => router.push("/pulse")}
          className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold mx-auto">
          {symbol.toUpperCase()} Price Chart 📈
        </h1>
      </div>

      <div className="flex justify-center gap-3 mb-6">
        {[1, 7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-2 rounded-lg font-semibold ${
              days === d ? "bg-[var(--accent)] text-black" : "bg-neutral-700 hover:bg-neutral-600"
            }`}
          >
            {d}D
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto bg-neutral-900 p-6 rounded-xl border border-[var(--accent)]/40 shadow-lg">
        <Line data={chartData} />
      </div>

      <p className="text-center text-gray-400 mt-10">
        Powered by Jupiter • CoinGecko API • Built on Solana ⚡
      </p>
    </div>
  );
}
