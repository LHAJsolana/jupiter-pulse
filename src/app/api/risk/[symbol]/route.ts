import { NextResponse } from "next/server";
import { computeRisk } from "../../../lib/riskEngine";

function hashToUnit(str: string) {
  // deterministic 0..1
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // >>> 0 forces unsigned
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = String(symbol || "").toUpperCase().trim() || "UNK";

  // Deterministic “mock” inputs (until you wire real liquidity/volatility)
  const u1 = hashToUnit(`${sym}:change`);
  const u2 = hashToUnit(`${sym}:vol`);
  const u3 = hashToUnit(`${sym}:liq`);
  const u4 = hashToUnit(`${sym}:whale`);

  const change24h = lerp(-8, 12, u1);          // -8% → +12%
  const volatility7d = lerp(1, 10, u2);        // 1 → 10
  const liquidityScore = lerp(15, 95, u3);     // 15 → 95
  const whaleDominance = lerp(5, 65, u4);      // 5% → 65%

  const risk = computeRisk({
    change24h,
    volatility7d,
    liquidityScore,
    whaleDominance,
  });

  return NextResponse.json({
    symbol: sym,
    ...risk,
    meta: {
      mode: "deterministic_stub",
      note:
        "Deterministic risk inputs (no Math.random). Replace with real inputs when you wire liquidity/volatility sources.",
      inputs: {
        change24h: Number(change24h.toFixed(2)),
        volatility7d: Number(volatility7d.toFixed(2)),
        liquidityScore: Number(liquidityScore.toFixed(0)),
        whaleDominance: Number(whaleDominance.toFixed(1)),
      },
    },
  });
}
