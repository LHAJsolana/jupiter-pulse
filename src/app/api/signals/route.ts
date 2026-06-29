import { NextResponse } from "next/server";
import { idMap } from "@/lib/api";
import { computeRisk } from "../../lib/riskEngine";

type MarketRow = {
  symbol: string;
  price: number | null;
  change24h: number | null;
};

function safeNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hashToUnit(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

async function loadMarket(): Promise<MarketRow[]> {
  const ids = Object.values(idMap).join(",");
  const url =
    `https://api.coingecko.com/api/v3/simple/price` +
    `?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "JupiterPulse/1.0 (contact: dev@jupiterpulse.app)",
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`CoinGecko market fetch failed: ${res.status}`);

  const data = await res.json();
  return Object.entries(idMap).map(([symbol, id]) => {
    const token = data?.[id];
    return {
      symbol: symbol.toUpperCase(),
      price: safeNum(token?.usd),
      change24h: safeNum(token?.usd_24h_change),
    };
  });
}

function classifySignal(row: MarketRow) {
  const change = row.change24h ?? 0;
  const symbol = row.symbol;

  const volatility7d = lerp(2, 10, hashToUnit(`${symbol}:volatility`));
  const liquidityScore = lerp(25, 95, hashToUnit(`${symbol}:liquidity`));
  const whaleDominance = lerp(8, 62, hashToUnit(`${symbol}:whales`));

  const risk = computeRisk({
    change24h: change,
    volatility7d,
    liquidityScore,
    whaleDominance,
  });

  const momentumScore = Math.max(0, Math.min(100, Math.round(50 + change * 3)));
  const riskPenalty = risk.level === "High" ? 18 : risk.level === "Medium" ? 8 : 0;
  const confidence = Math.max(35, Math.min(95, momentumScore - riskPenalty + 12));

  let bias: "Bullish" | "Bearish" | "Neutral" = "Neutral";
  if (change >= 3 && risk.level !== "High") bias = "Bullish";
  if (change <= -3 || (change < 1 && risk.level === "High")) bias = "Bearish";

  let type = "Neutral Market Pulse";
  let message = `${symbol} is mostly neutral, with no strong 24h directional edge.`;

  if (change >= 7 && risk.level === "High") {
    type = "Overheated Pump Warning";
    message = `${symbol} is up sharply, but risk is elevated. Momentum may be crowded.`;
  } else if (change >= 4) {
    type = "Momentum Breakout";
    message = `${symbol} momentum is improving with a positive 24h move.`;
  } else if (change <= -5) {
    type = "Cooling After Selloff";
    message = `${symbol} is weakening after a sharp 24h move lower.`;
  } else if (change < 0 && risk.level !== "Low") {
    type = "Risk-Off Drift";
    message = `${symbol} is cooling while risk remains ${risk.level.toLowerCase()}.`;
  } else if (change > 0 && risk.level === "High") {
    type = "Momentum With Elevated Risk";
    message = `${symbol} is green, but risk factors are elevated.`;
  }

  return {
    id: `${symbol}-${Math.round(change * 100)}-${risk.score}`,
    symbol,
    price: row.price,
    change24h: row.change24h,
    type,
    message,
    score: momentumScore,
    bias,
    confidence: Math.round(confidence),
    risk,
    time: "live",
    meta: {
      source: "market_api",
      deterministicRiskInputs: {
        volatility7d: Number(volatility7d.toFixed(2)),
        liquidityScore: Number(liquidityScore.toFixed(0)),
        whaleDominance: Number(whaleDominance.toFixed(1)),
      },
    },
  };
}

export async function GET() {
  try {
    const market = await loadMarket();
    const feed = market
      .filter((row) => row.price !== null)
      .map(classifySignal)
      .sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json(feed);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate signals" },
      { status: 502 }
    );
  }
}
