import { NextResponse } from "next/server";
import {
  chooseTradedToken,
  fetchHeliusTransactions,
  fmtPair,
  normalizeSymbol,
  parseHeliusSwaps,
  type SwapLike,
} from "@/lib/walletSwaps";

type Lot = { qty: number; costUsd: number; ts: number };

function timeAgo(tsSec: number) {
  const diff = Date.now() - tsSec * 1000;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function computeStatsFromSwaps(swaps: SwapLike[]) {
  const lotsBySymbol = new Map<string, Lot[]>();

  let totalVolumeUsd = 0;
  let trades = 0;
  let realizedCount = 0;
  let realizedWins = 0;

  const ordered = [...swaps].sort((a, b) => a.ts - b.ts);

  for (const s of ordered) {
    if (!s.priced || s.usdValue <= 0) continue;

    totalVolumeUsd += s.usdValue;
    trades += 1;

    const traded = chooseTradedToken(s.inputSym, s.outputSym);
    const inputSym = s.inputSym ? normalizeSymbol(s.inputSym) : null;
    const outputSym = s.outputSym ? normalizeSymbol(s.outputSym) : null;

    const receives = outputSym === traded;
    const sends = inputSym === traded;
    const qty = receives ? s.outputAmt : sends ? s.inputAmt : 0;
    if (qty <= 0) continue;

    if (receives && !sends) {
      const lots = lotsBySymbol.get(traded) || [];
      lots.push({ qty, costUsd: s.usdValue, ts: s.ts });
      lotsBySymbol.set(traded, lots);
    }

    if (sends && !receives) {
      const lots = lotsBySymbol.get(traded) || [];
      let remaining = qty;
      let costUsed = 0;

      while (remaining > 1e-12 && lots.length) {
        const lot = lots[0];
        const takeQty = Math.min(lot.qty, remaining);
        const takeCost = (lot.costUsd * takeQty) / lot.qty;

        costUsed += takeCost;
        lot.qty -= takeQty;
        lot.costUsd -= takeCost;
        remaining -= takeQty;

        if (lot.qty <= 1e-12) lots.shift();
      }

      lotsBySymbol.set(traded, lots);

      if (costUsed > 0) {
        const pnl = s.usdValue - costUsed;
        realizedCount += 1;
        if (pnl >= 0) realizedWins += 1;
      }
    }
  }

  const winRate = realizedCount ? Math.round((realizedWins / realizedCount) * 100) : 0;

  return {
    totalVolumeUsd: Math.round(totalVolumeUsd),
    trades,
    winRate,
    realizedCount,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || address.length < 32) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) {
    return NextResponse.json({ error: "Missing HELIUS_API_KEY in .env.local" }, { status: 500 });
  }

  const fetched = await fetchHeliusTransactions({ address, apiKey: heliusKey, desired: 600 });

  if (!fetched.ok) {
    return NextResponse.json(
      { error: `Helius error ${fetched.status}: ${fetched.errorText}` },
      { status: 500 }
    );
  }

  const txs = fetched.txs || [];
  const {
    swaps,
    jupiterPriceIdsRequested,
    jupiterPriceIdsResolved,
    jupiterEnrichedSwaps,
  } = await parseHeliusSwaps(txs, address);

  const nowSec = Math.floor(Date.now() / 1000);
  const cutoffSec = nowSec - 30 * 24 * 3600;

  const windowed = swaps.filter((s) => s.ts >= cutoffSec);
  const stats = computeStatsFromSwaps(windowed);

  const recent = [...windowed]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20)
    .map((s) => {
      const traded = chooseTradedToken(s.inputSym, s.outputSym);
      const side = s.outputSym && normalizeSymbol(s.outputSym) === traded ? "BUY" : "SELL";

      return {
        symbol: fmtPair(s),
        side,
        usd: Math.round(s.priced ? s.usdValue : 0),
        time: timeAgo(s.ts),
        signature: s.signature,
        priced: s.priced,
      };
    });

  return NextResponse.json({
    address,
    stats: {
      totalVolume: stats.totalVolumeUsd,
      winRate: stats.winRate,
      trades: stats.trades,
    },
    activity: recent,
    meta: {
      range: "30D",
      txFetched: txs.length,
      pagesFetched: fetched.pages,
      swapsDetected: windowed.length,
      realizedSells: stats.realizedCount,
      jupiterPriceIdsRequested,
      jupiterPriceIdsResolved,
      jupiterEnrichedSwaps,
      supportsLimit: fetched.supportsLimit,
      supportsBefore: fetched.supportsBefore,
      note:
        "WinRate is computed from realized sells where USD value can be inferred. Jupiter mint pricing improves token-to-token coverage.",
    },
  });
}
