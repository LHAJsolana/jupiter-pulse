import { NextResponse } from "next/server";

const MAP: Record<string, string> = {
  SOL: "solana",
  WIF: "dogwifcoin",
  BONK: "bonk",
  JUP: "jupiter-exchange-solana",
  USDC: "usd-coin",
};

export async function GET() {
  try {
    const ids = Object.values(MAP).join(",");

    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error("CoinGecko price error:", res.status);
      return NextResponse.json([], { status: 200 });
    }

    const data = await res.json();

    const result = Object.entries(MAP).map(([symbol, id]) => ({
      symbol,
      price: data[id]?.usd ?? 0,
      change: data[id]?.usd_24h_change ?? 0,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("Prices API error:", e);
    return NextResponse.json([], { status: 500 });
  }
}
