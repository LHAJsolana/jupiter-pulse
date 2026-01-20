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
        <h1 className="text-4xl font-extrabold">📡 Live Signals</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
          {SIGNALS.map((s) => (
            <Link
              key={s.symbol}
              href={`/pulse/${s.symbol}`}
              className="p-6 rounded-2xl border border-white/10 bg-white/5"
            >
              <div className="text-2xl font-bold">{s.symbol}</div>
              <div className={`text-sm ${biasColor(s.bias)}`}>
                {s.bias}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
