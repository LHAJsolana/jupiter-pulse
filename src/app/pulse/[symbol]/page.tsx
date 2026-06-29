"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chart } from "react-chartjs-2";
import type { ChartOptions, TooltipItem } from "chart.js";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Filler,
} from "chart.js";

import { computeSmartMoneyIndex, type SmartMoneyResult } from "../../lib/smartMoney";
import { evaluateTokenAlerts } from "../../lib/autoAlerts";

let chartRegistered = false;
function registerChart() {
  if (!chartRegistered) {
    ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Filler);
    chartRegistered = true;
  }
}

const TIMEFRAMES = [
  { label: "1D", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

type PricePoint = [number, number];

type RiskData = {
  score: number;
  level: "Low" | "Medium" | "High";
  factors: string[];
};

type SignalData = {
  symbol: string;
  type: string;
  message: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  confidence: number;
  score: number;
};

function formatPrice(price: number) {
  if (!Number.isFinite(price)) return "-";
  if (price >= 100) return `$${price.toFixed(2)}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.01) return `$${price.toFixed(5)}`;
  return `$${price.toPrecision(5)}`;
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function SymbolPage() {
  registerChart();

  const params = useParams();
  const router = useRouter();

  const symbol = typeof params?.symbol === "string" ? params.symbol : null;
  const SYMBOL = symbol ? symbol.toUpperCase() : "";
  const apiSymbol = symbol ? symbol.toLowerCase() : "";

  const [prices, setPrices] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [smartMoney, setSmartMoney] = useState<SmartMoneyResult | null>(null);

  useEffect(() => {
    if (!apiSymbol) return;
    loadHistory(days);
    loadRisk();
    loadSignal();
  }, [apiSymbol, days]);

  async function loadHistory(windowDays: number) {
    try {
      setLoading(true);
      const res = await fetch(`/api/prices/history/${apiSymbol}?days=${windowDays}`, {
        cache: "no-store",
      });
      const data: { prices?: PricePoint[] } = await res.json();
      if (!Array.isArray(data.prices)) return;

      setPrices(data.prices.map((p) => p[1]));
      setLabels(
        data.prices.map((p) =>
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

  async function loadRisk() {
    try {
      const res = await fetch(`/api/risk/${apiSymbol}`, { cache: "no-store" });
      setRisk(await res.json());
    } catch {
      setRisk(null);
    }
  }

  async function loadSignal() {
    try {
      const res = await fetch("/api/signals", { cache: "no-store" });
      const data = await res.json();
      if (!Array.isArray(data)) {
        setSignal(null);
        return;
      }
      setSignal(data.find((s: SignalData) => s.symbol === SYMBOL) || null);
    } catch {
      setSignal(null);
    }
  }

  const priceStats = useMemo(() => {
    if (prices.length < 2) return null;
    const first = prices[0];
    const last = prices[prices.length - 1];
    const changePct = ((last - first) / first) * 100;
    return { last, changePct };
  }, [prices]);

  const chartStats = useMemo(() => {
    if (!prices.length) return null;
    const first = prices[0];
    const current = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const rangePct = low > 0 ? ((high - low) / low) * 100 : 0;

    return {
      first,
      current,
      high,
      low,
      rangePct,
      points: prices.length,
      startLabel: labels[0] || "-",
      endLabel: labels[labels.length - 1] || "-",
    };
  }, [labels, prices]);

  useEffect(() => {
    if (!priceStats || !risk) return;

    const signalConfidence =
      priceStats.changePct > 6 ? 75 : priceStats.changePct < -6 ? 70 : 60;

    setSmartMoney(
      computeSmartMoneyIndex({
        priceChangePct: priceStats.changePct,
        riskScore: risk.score,
        signalConfidence,
      })
    );
  }, [priceStats, risk]);

  useEffect(() => {
    if (!smartMoney || !SYMBOL) return;
    evaluateTokenAlerts(SYMBOL, smartMoney);
  }, [smartMoney, SYMBOL]);

  const chartTone = (priceStats?.changePct ?? 0) >= 0 ? "green" : "red";
  const chartColor = chartTone === "green" ? "#00FFA3" : "#FF5A66";
  const chartFill = chartTone === "green" ? "rgba(0,255,163,0.14)" : "rgba(255,90,102,0.14)";

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: `${SYMBOL} price`,
          data: prices,
          borderColor: chartColor,
          backgroundColor: chartFill,
          borderWidth: 3,
          tension: 0.32,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBorderWidth: 2,
          pointHoverBackgroundColor: "#020403",
          pointHoverBorderColor: chartColor,
          fill: true,
          yAxisID: "price",
        },
      ],
    }),
    [SYMBOL, chartColor, chartFill, labels, prices]
  );

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        intersect: false,
        mode: "index",
        displayColors: false,
        backgroundColor: "rgba(0,0,0,0.9)",
        titleColor: "#E5E7EB",
        bodyColor: "#A7F3D0",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: TooltipItem<"line">) => {
            const value = context.parsed.y;
            if (value === null) return `${SYMBOL}: -`;
            return `${SYMBOL}: ${formatPrice(value)}`;
          },
          afterLabel: (context: TooltipItem<"line">) => {
            const first = prices[0];
            const value = context.parsed.y;
            if (!first || value === null) return "";
            return `Window change: ${formatPct(((value - first) / first) * 100)}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        border: { display: false },
        grid: {
          color: "rgba(255,255,255,0.035)",
          drawTicks: false,
        },
        ticks: {
          color: "rgba(226,232,240,0.55)",
          maxTicksLimit: days <= 1 ? 6 : 8,
          padding: 12,
          font: { size: 12 },
        },
      },
      price: {
        display: true,
        position: "right",
        border: { display: false },
        grid: {
          color: "rgba(255,255,255,0.055)",
          drawTicks: false,
        },
        ticks: {
          color: "rgba(226,232,240,0.65)",
          padding: 12,
          maxTicksLimit: 6,
          font: { size: 12 },
          callback: (value) => formatPrice(Number(value)),
        },
      },
    },
  };

  if (!symbol || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-gray-400">
        Loading...
      </div>
    );
  }

  const trendLabel = priceStats
    ? priceStats.changePct >= 6
      ? "Strong upside"
      : priceStats.changePct <= -6
        ? "Sharp downside"
        : priceStats.changePct >= 0
          ? "Constructive"
          : "Cooling"
    : "No trend";

  return (
    <div className="min-h-screen bg-black text-white px-6 pt-2 pb-16">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          <InfoCard
            label="Trend"
            title={trendLabel}
            detail={
              priceStats
                ? `${priceStats.changePct.toFixed(2)}% over selected window`
                : "Waiting for chart data"
            }
          />

          <InfoCard
            label="Risk"
            title={risk ? `${risk.level} (${risk.score})` : "Loading"}
            detail={
              risk?.factors?.length
                ? risk.factors.slice(0, 2).join(", ")
                : "No major factors surfaced"
            }
          />

          <InfoCard
            label="Live Signal"
            title={signal?.type || "No signal yet"}
            detail={
              signal
                ? `${signal.bias} / ${signal.confidence} confidence`
                : "Generated from /api/signals"
            }
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/80">
          <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                Price Chart
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-2xl font-extrabold">{SYMBOL}</h1>
                {chartStats && (
                  <span className="text-xl font-bold text-white">
                    {formatPrice(chartStats.current)}
                  </span>
                )}
                {priceStats && (
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      priceStats.changePct >= 0
                        ? "bg-emerald-400/15 text-emerald-200"
                        : "bg-red-400/15 text-red-200",
                    ].join(" ")}
                  >
                    {formatPct(priceStats.changePct)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.days}
                  type="button"
                  onClick={() => setDays(t.days)}
                  className={[
                    "min-w-14 rounded-full px-4 py-2 text-sm font-semibold transition",
                    days === t.days
                      ? "bg-[#00E887] text-black shadow-[0_0_24px_rgba(0,232,135,0.25)]"
                      : "border border-white/10 text-slate-300 hover:border-white/25 hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[520px] p-5 lg:p-7">
            <Chart type="line" data={chartData} options={chartOptions} />
          </div>

          {chartStats && (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl border-t border-white/10 bg-white/10 md:grid-cols-5">
              <ChartStat label="Current" value={formatPrice(chartStats.current)} />
              <ChartStat label="High" value={formatPrice(chartStats.high)} />
              <ChartStat label="Low" value={formatPrice(chartStats.low)} />
              <ChartStat label="Range" value={formatPct(chartStats.rangePct)} />
              <ChartStat label="Data" value={`${chartStats.points} pts`} />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <div>
            Chart shows price only. Hover the line to read date, price, and window change.
          </div>
          {chartStats && (
            <div>
              Window: {chartStats.startLabel} &rarr; {chartStats.endLabel}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => router.back()}
          className="mt-8 text-xl text-slate-300 underline"
        >
          &larr; Back
        </button>
      </div>
    </div>
  );
}

function ChartStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/80 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-base font-bold text-slate-100">{value}</div>
    </div>
  );
}

function InfoCard({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/70 p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-extrabold">{title}</div>
      <div className="mt-2 text-lg text-slate-300">{detail}</div>
    </div>
  );
}
