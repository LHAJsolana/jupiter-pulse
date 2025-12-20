import { NextResponse } from "next/server";

export async function GET() {
  const data = {
    status: "ok",
    timestamp: Date.now(),
    pulse: {
      solana: {
        sentiment: "bullish",
        activity: "high",
      },
      trending: ["SOL", "JUP", "BONK", "WIF"],
    },
  };

  return NextResponse.json(data);
}
