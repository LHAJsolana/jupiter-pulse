// src/app/api/wallets/[address]/route.ts
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: { address: string } }
) {
  const { address } = params;

  return NextResponse.json({
    address,
    stats: {
      totalVolume: 1_240_000,
      winRate: 68,
      trades: 124,
    },
    activity: Array.from({ length: 20 }).map(() => ({
      symbol: ["SOL", "JUP", "WIF", "BONK"][Math.floor(Math.random() * 4)],
      side: Math.random() > 0.5 ? "BUY" : "SELL",
      usd: Math.floor(Math.random() * 120_000),
      time: "just now",
    })),
  });
}
