"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chart } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";

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

import {
  saveAlert,
  hasAlert,
  triggerNotification,
} from "../../lib/alertsEngine";

import {
  computeSmartMoneyIndex,
  SmartMoneyResult,
} from "../../lib/smartMoney";

import { evaluateTokenAlerts } from "../../lib/autoAlerts";

/* =====================
   SAFE CHART REGISTRATION
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

type RiskData = {
  score: number;
  level: "Low" | "Medium" | "High";
  factors: string[];
};

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

  const [risk, setRisk] = useState<RiskData | null>(null);
  const [smartMoney, setSmartMoney] =
    useState<SmartMoneyResult | null>(null);

  /* =====================
     DATA LOADING
  ====================== */

  useEffect(() => {
    if (!apiSymbol) return;
    loadHistory(days);
    loadRisk();
  }, [apiSymbol, days]);

  async function loadHistory(days: number) {
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

  async function loadRisk() {
    try {
      const res = await fetch(`/api/risk/${apiSymbol}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setRisk(data);
    } catch {
      setRisk(null);
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
     SMART MONEY INDEX
  ====================== */

  useEffect(() => {
    if (!priceStats || !risk) return;

    const signalConfidence =
      priceStats.changePct > 6
        ? 75
        : priceStats.changePct < -6
        ? 70
        : 60;

    const smi = computeSmartMoneyIndex({
      priceChangePct: priceStats.changePct,
      riskScore: risk.score,
      signalConfidence,
    });

    setSmartMoney(smi);
  }, [priceStats, risk]);

  /* =====================
     AUTO ALERTS (🔥)
  ====================== */

  useEffect(() => {
    if (!smartMoney || !SYMBOL) return;
    evaluateTokenAlerts(SYMBOL, smartMoney);
  }, [smartMoney, SYMBOL]);

  /* =====================
     CHART CONFIG
  ====================== */

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Volume",
          type: "bar" as const,
          data: volumes,
          backgroundColor: "rgba(0,255,163,0.12)",
          yAxisID: "volume",
        },
        {
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

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      price: { display: false },
      volume: { display: false },
    },
  };

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

          <button
            onClick={() => {
              if (hasAlert("TOKEN", SYMBOL)) return;

              saveAlert({
                id: crypto.randomUUID(),
                type: "TOKEN",
                target: SYMBOL,
                condition: "smart-money",
                createdAt: Date.now(),
              });

              triggerNotification(
                "Token Alert Added",
                `Auto alerts enabled for ${SYMBOL}`
              );
            }}
            className="px-4 py-2 rounded-full border border-white/10 hover:border-green-400 transition text-sm"
          >
            Follow {SYMBOL}
          </button>
        </div>

        {/* SMART MONEY INDEX */}
        {smartMoney && (
          <div className="mb-6 p-5 rounded-xl border border-white/10">
            <div className="text-sm text-gray-400">
              Smart Money Index
            </div>
            <div className="flex items-end gap-3 mt-1">
              <div className="text-4xl font-bold">
                {smartMoney.score}
              </div>
              <div
                className={`text-sm ${
                  smartMoney.bias === "Bullish"
                    ? "text-green-400"
                    : smartMoney.bias === "Bearish"
                    ? "text-red-400"
                    : "text-gray-300"
                }`}
              >
                {smartMoney.bias}
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-400">
              Momentum: {smartMoney.breakdown.momentum} ·
              Signal: {smartMoney.breakdown.signalStrength} ·
              Risk Adj: {smartMoney.breakdown.riskAdjustment}
            </div>
          </div>
        )}

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
        <div className="rounded-xl border border-white/10 bg-black/50 p-6 h-[420px]">
          <Chart type="line" data={chartData} options={chartOptions} />
        </div>

        <button
          onClick={() => router.back()}
          className="mt-6 text-gray-400 underline"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
