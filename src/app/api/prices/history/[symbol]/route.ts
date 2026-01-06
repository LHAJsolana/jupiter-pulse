import { NextResponse } from "next/server";

const ID_MAP: Record<string, string> = {
  sol: "solana",
  wif: "dogwifcoin",
  jup: "jupiter-exchange-solana",
  bonk: "bonk",
  usdc: "usd-coin",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    // ✅ unwrap params (THIS IS THE FIX)
    const { symbol } = await params;
    const s = symbol.toLowerCase();

    if (!ID_MAP[s]) {
      return NextResponse.json({ prices: [] });
    }

    const { searchParams } = new URL(req.url);
    const days = searchParams.get("days") || "7";

    const url = `https://api.coingecko.com/api/v3/coins/${ID_MAP[s]}/market_chart?vs_currency=usd&days=${days}`;

    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });

    const data = await res.json();

    return NextResponse.json({
      prices: Array.isArray(data.prices) ? data.prices : [],
    });
  } catch (err) {
    console.error("History API error:", err);
    return NextResponse.json({ prices: [] });
  }
}
