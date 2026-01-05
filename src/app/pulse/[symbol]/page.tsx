"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

export default function SymbolPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();

  const symbol = params?.symbol?.toUpperCase();

  const [history, setHistory] = useState<number[][] | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory(d = days) {
    if (!symbol) return;

    try {
      setLoading(true);

      const res = await fetch(
        `/api/prices/history/${symbol}?days=${d}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!data?.prices || data.prices.length === 0) {
        setError("No price history data available.");
        return;
      }

      setHistory(data.prices);
      setError(null);

      // cache for sparklines
      localStorage.setItem(
        `history-${symbol}`,
        JSON.stringify(data.prices)
      );
    } catch (err) {
      console.error("History fetch error:", err);
      setError("Unable to load chart");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    const interval = setInterval(() => loadHistory(days), 25000);
    return () => clearInterval(interval);
  }, [days, symbol]);

  if (error) {
    return (
      <div className="text-red-400 text-center pt-40">
        ❌ {error}
        <br />
        <button onClick={() => router.back()} className="mt-4 underline">
          Go Back
        </button>
      </div>
    );
  }

  if (!history || loading || !symbol) {
    return (
      <div className="text-gray-300 text-center pt-40 text-xl animate-pulse">
        Loading {symbol ?? ""} chart...
      </div>
    );
  }

  const chartData = {
    labels: history.map((p) =>
      new Date(p[0]).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    ),
    datasets: [
      {
        label: `${symbol} Price`,
        data: history.map((p) => p[1]),
        borderColor: "#00FFA3",
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        fill: true,
        backgroundColor: (context: any) => {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return null;

          const gradient = ctx.createLinearGradient(
            0,
            chartArea.top,
            0,
            chartArea.bottom
          );

          gradient.addColorStop(0, "rgba(0, 255, 163, 0.35)");
          gradient.addColorStop(1, "rgba(0, 255, 163, 0)");

          return gradient;
        },
      },
    ],
  };

  // ✅ Typed options (this fixes Vercel)
  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false },
    },
    scales: {
      x: {
        grid: { display: false },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: {
          callback: (value) => {
            const num = typeof value === "number" ? value : Number(value);
            return `$${num}`;
          },
        },
      },
    },
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
          {symbol} Price Chart 📈
        </h1>
      </div>

      <div className="flex justify-center gap-3 mb-6">
        {[1, 7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-2 rounded-lg font-semibold ${
              days === d
                ? "bg-[#00FFA3] text-black"
                : "bg-neutral-700 hover:bg-neutral-600"
            }`}
          >
            {d}D
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto h-[420px] bg-neutral-900 p-6 rounded-xl border border-[#00FFA3]/40 shadow-lg">
        <Line data={chartData} options={options} />
      </div>

      <p className="text-center text-gray-400 mt-10">
        Powered by Jupiter • CoinGecko API • Built on Solana ⚡
      </p>
    </div>
  );
}
