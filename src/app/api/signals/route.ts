import { NextResponse } from "next/server";
import { computeRisk } from "../../lib/riskEngine";

const SIGNALS = [
  "Whale Accumulation",
  "Distribution Detected",
  "Momentum Breakout",
  "Overheated Pump Warning",
];

export async function GET() {
  const feed = Array.from({ length: 8 }).map(() => {
    const symbol = ["SOL", "JUP", "WIF", "BONK"][Math.floor(Math.random() * 4)];

    const risk = computeRisk({
      change24h: Math.random() * 15 - 5,
      volatility7d: Math.random() * 10,
      liquidityScore: Math.random() * 100,
      whaleDominance: Math.random() * 60,
    });

    return {
      id: crypto.randomUUID(),
      symbol,
      type: SIGNALS[Math.floor(Math.random() * SIGNALS.length)],
      confidence: Math.floor(Math.random() * 30 + 60),
      risk,
      time: "just now",
    };
  });

  return NextResponse.json(feed);
}
