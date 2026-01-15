"use client";

import Link from "next/link";

type Signal = {
  symbol: string;
  score: number;
  bias: "Bullish" | "Bearish" | "Neutral";
  confidence: number;
};

const SIGNALS: Signal[] = [
  { symbol: "SOL", score: 82, bias: "Bullish", confidence: 78 },
  { symbol: "JUP", score: 74, bias: "Bullish", confidence: 71 },
  { symbol: "WIF", score: 48, bias: "Neutral", confidence: 60 },
  { symbol: "BONK", score: 32, bias: "Bearish", confidence: 66 },
];

function biasColor(bias: Signal["bias"]) {
  if (bias === "Bullish") return "text-green-400";
  if (bias === "Bearish") return "text-red-400";
  return "text-gray-300";
}

export default function SignalsPage() {
  return (
    <div className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold">📡 Live Signals</h1>
          <p className="text-gray-400 mt-2">
            Smart Money & risk-adjusted momentum signals
          </p>
        </div>

        {/* SIGNALS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SIGNALS.map((s) => (
            <Link
              key={s.symbol}
              href={`/pulse/${s.symbol}`}
              className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:border-[#00FFA3]/40 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-2xl font-bold">{s.symbol}</div>
                  <div
                    className={`text-sm mt-1 font-semibold ${biasColor(
                      s.bias
                    )}`}
                  >
                    {s.bias} Signal
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-bold">{s.score}</div>
                  <div className="text-xs text-gray-400">
                    Confidence {s.confidence}%
                  </div>
                </div>
              </div>

              {/* SCORE BAR */}
              <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#00FFA3]"
                  style={{ width: `${s.score}%` }}
                />
              </div>

              <div className="mt-3 text-sm text-gray-400">
                View pulse →
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-14 text-sm text-gray-500">
          Signals are derived from Smart Money Index & risk metrics.
        </div>
      </div>
    </div>
  );
}
