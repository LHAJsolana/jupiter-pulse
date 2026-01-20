import { NextResponse } from "next/server";
import { idMap } from "@/lib/api";

export async function GET() {
  try {
    const ids = Object.values(idMap).join(",");

    const url =
      `https://api.coingecko.com/api/v3/simple/price` +
      `?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "JupiterPulse/1.0 (contact: dev@jupiterpulse.app)",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "CoinGecko market fetch failed" }, { status: 502 });
    }

    const data = await res.json();

    const prices = Object.entries(idMap).map(([symbol, id]) => {
      const token = data[id];
      return {
        symbol,
        price: token?.usd ?? null,
        change24h: token?.usd_24h_change ?? null,
      };
    });

    return NextResponse.json(prices);
  } catch {
    return NextResponse.json({ error: "Internal market error" }, { status: 500 });
  }
}
