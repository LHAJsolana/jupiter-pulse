import { NextResponse } from "next/server";

const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcP2mNn6jT2Q6Zp2sJqA",
};

export async function GET() {
  try {
    const ids = Object.values(TOKENS).join(",");

    // ✅ Fallback-safe Jupiter endpoint
    const res = await fetch(
      `https://quote-api.jup.ag/v6/price?ids=${ids}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      throw new Error("Jupiter API not OK");
    }

    const data = await res.json();

    return NextResponse.json({
      status: "ok",
      source: "jupiter-quote-api",
      prices: {
        SOL: data.data[TOKENS.SOL]?.price ?? null,
        JUP: data.data[TOKENS.JUP]?.price ?? null,
        BONK: data.data[TOKENS.BONK]?.price ?? null,
        WIF: data.data[TOKENS.WIF]?.price ?? null,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("Pulse API error:", e.message);

    return NextResponse.json(
      {
        status: "error",
        message: e.message,
        prices: {},
      },
      { status: 503 }
    );
  }
}
