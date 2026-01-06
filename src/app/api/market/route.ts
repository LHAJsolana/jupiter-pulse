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
        // REQUIRED for CoinGecko reliability
        "User-Agent": "JupiterPulse/1.0 (contact: dev@jupiterpulse.app)",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("❌ CoinGecko Market Error:", res.status, text);

      return NextResponse.json(
        { error: "CoinGecko market fetch failed" },
        { status: 502 }
      );
    }

    const data = await res.json();

    const prices = Object.entries(idMap).map(([symbol, id]) => {
      const token = data[id];

      return {
        symbol,
        price:
          typeof token?.usd === "number" ? token.usd : null,
        change24h:
          typeof token?.usd_24h_change === "number"
            ? token.usd_24h_change
            : null,
      };
    });

    return NextResponse.json(prices, { status: 200 });
  } catch (e) {
    console.error("🔥 Market API Fatal Error:", e);
    return NextResponse.json(
      { error: "Internal market error" },
      { status: 500 }
    );
  }
}
