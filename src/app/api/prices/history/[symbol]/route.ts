import { NextResponse } from "next/server";

const ID_MAP: Record<string, string> = {
  sol: "solana",
  eth: "ethereum",
  btc: "bitcoin",
  bonk: "bonk",
  jup: "jupiter-exchange-solana",
  sui: "sui",
  apt: "aptos",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // extract symbol safely
    const parts = url.pathname.split("/");
    const symbol = parts[parts.length - 1]?.toLowerCase();

    if (!symbol || !ID_MAP[symbol]) {
      return NextResponse.json({ prices: [] }, { status: 400 });
    }

    const days = url.searchParams.get("days") ?? "7";
    const id = ID_MAP[symbol];

    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("CoinGecko error");

    const data = await res.json();
    return NextResponse.json({ prices: data.prices });
  } catch (e) {
    console.error("History API error:", e);
    return NextResponse.json({ prices: [] }, { status: 500 });
  }
}
