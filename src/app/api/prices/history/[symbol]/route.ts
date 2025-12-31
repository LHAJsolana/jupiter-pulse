import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  context: { params: { symbol: string } }
) {
  const symbol = context.params.symbol.toLowerCase();
  const { searchParams } = new URL(req.url);
  const days = searchParams.get("days") || "7";

  const idMap: Record<string, string> = {
    sol: "solana",
    eth: "ethereum",
    btc: "bitcoin",
    bonk: "bonk",
    jup: "jupiter-exchange-solana",
    sui: "sui",
    apt: "aptos",
  };

  const id = idMap[symbol];
  if (!id) return NextResponse.json({ prices: [] });

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
      { cache: "no-store" }
    );

    const data = await res.json();
    return NextResponse.json({ prices: data.prices, symbol, days });
  } catch (e) {
    console.log("❌ History fetch error:", e);
    return NextResponse.json({ prices: [] }, { status: 500 });
  }
}
