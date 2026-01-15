import { NextResponse } from "next/server";
import { computeRisk } from "../../../lib/riskEngine";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  void symbol;

  const risk = computeRisk({
    change24h: Math.random() * 15 - 5,   // -5% → +10%
    volatility7d: Math.random() * 10,    // 0 → 10
    liquidityScore: Math.random() * 100, // 0 → 100
    whaleDominance: Math.random() * 60,  // 0% → 60%
  });

  return NextResponse.json(risk);
}
