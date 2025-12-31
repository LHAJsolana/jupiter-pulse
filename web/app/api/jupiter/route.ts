import { NextResponse } from "next/server";

export const runtime = "nodejs"; // ⬅️ IMPORTANT

const JUPITER_URL =
  "https://price.jup.ag/v6/price?ids=SOL,JUP,BONK,WIF&vsToken=USDC";

export async function GET() {
  try {
    const res = await fetch(JUPITER_URL, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "user-agent": "jupiter-pulse/1.0",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Jupiter HTTP ${res.status}`);
    }

    const json = await res.json();

    const prices = {
      SOL: json?.data?.SOL?.price ?? null,
      JUP: json?.data?.JUP?.price ?? null,
      BONK: json?.data?.BONK?.price ?? null,
      WIF: json?.data?.WIF?.price ?? null,
    };

    return NextResponse.json({
      status: "ok",
      timestamp: Date.now(),
      prices,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: err.message || "Failed to fetch Jupiter prices",
      },
      { status: 500 }
    );
  }
}
