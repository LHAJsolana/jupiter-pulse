import { NextResponse } from "next/server";

const MAP: Record<string, string> = {
  SOL: "solana",
  WIF: "dogwifcoin",
  BONK: "bonk",
  JUP: "jupiter-exchange-solana",
  USDC: "usd-coin"
};

export async function GET() {
  try {
    const ids = Object.values(MAP).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    const response = Object.keys(MAP).map((sym) => {
      const key = MAP[sym];

      return {
        symbol: sym,
        price: data[key]?.usd ?? 0,
        change: data[key]?.usd_24h_change ?? 0
      };
    });

    return NextResponse.json(response, { status: 200 });

  } catch (e) {
    console.log("Prices API ERROR =>", e);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
