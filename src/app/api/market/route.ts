import { NextResponse } from "next/server";
import { idMap } from "@/lib/api";

export async function GET() {
  try {
    const prices = await Promise.all(
      Object.keys(idMap).map(async (symbol) => {
        const id = idMap[symbol];
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`
        );
        const data = await res.json();
        return {
          symbol,
          price: data[id]?.usd || 0,
          change24h: data[id]?.usd_24h_change || 0,
        };
      })
    );

    return NextResponse.json(prices);
  } catch (e) {
    console.log("🔥 Market API Error:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
