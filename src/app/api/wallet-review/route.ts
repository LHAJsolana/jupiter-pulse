// src/app/api/wallet-review/route.ts
import { NextResponse } from "next/server";

type Trade = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  usd: number;
  entry: number;
  exit: number;
  pnlUsd: number;
  pnlPct: number;
  timeInHours: number;
  missedUpsideUsd: number;
  ateDrawdownUsd: number;
};

type Lot = {
  qty: number;
  costUsd: number;
  ts: number; // seconds
};

const STABLES = new Set(["USDC", "USDT"]);
const COMMON_BASES = new Set(["SOL", "WSOL", "USDC", "USDT"]);

function fmtAddress(a: string) {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function buildTips(summary: {
  realizedPnl: number;
  winRate: number;
  avgWinUsd: number;
  avgLossUsd: number;
  trades: number;
  realizedTrades: number;
}) {
  const tips: string[] = [];

  if (summary.realizedTrades < 3) {
    tips.push(
      "Not enough realized sells yet to judge performance confidently → keep trading, then re-check this report."
    );
  } else {
    if (summary.avgLossUsd > summary.avgWinUsd) {
      tips.push(
        "Your average loss is bigger than your average win → tighten invalidation (stop) or take partial profits earlier."
      );
    } else {
      tips.push(
        "Your average win beats your average loss → keep the edge: avoid overtrading and stick to your best setups."
      );
    }

    if (summary.winRate < 45) {
      tips.push(
        "Win rate is low → reduce random entries: trade fewer tokens, wait for clearer confirmation, and size smaller."
      );
    } else if (summary.winRate > 60) {
      tips.push(
        "Strong win rate → consider scaling out instead of full exits to capture more trend continuation."
      );
    }
  }

  tips.push(
    "Missed-money (sold early / bought late) is disabled for now → next step is adding price candles to compute it accurately."
  );

  tips.push(
    "Simple upgrade: pre-plan the trade (entry, invalidation, targets) before clicking swap — consistency beats speed."
  );

  return tips.slice(0, 5);
}

function pickSymbolFromToken(token: any): string | null {
  const sym = token?.symbol;
  if (typeof sym === "string" && sym.trim()) return sym.trim().toUpperCase();
  return null;
}

function pickAmountFromToken(token: any): number {
  const a =
    safeNum(token?.tokenAmount) ||
    safeNum(token?.amount) ||
    safeNum(token?.rawTokenAmount?.tokenAmount) ||
    0;
  return a;
}

function normalizeSymbol(sym: string) {
  const s = sym.toUpperCase();
  if (s === "WSOL") return "SOL";
  return s;
}

function isCommonBase(sym: string) {
  return COMMON_BASES.has(sym);
}

function chooseTradedToken(inputSym?: string | null, outputSym?: string | null) {
  const a = inputSym ? normalizeSymbol(inputSym) : null;
  const b = outputSym ? normalizeSymbol(outputSym) : null;

  if (a && !isCommonBase(a)) return a;
  if (b && !isCommonBase(b)) return b;

  if (a === "SOL") return "SOL";
  if (b === "SOL") return "SOL";

  return a || b || "UNK";
}

function parseHeliusSwaps(txs: any[]) {
  return txs
    .map((tx) => {
      const swap = tx?.events?.swap;
      if (!swap) return null;

      const ts = safeNum(tx?.timestamp) || 0;
      const signature = String(tx?.signature || "");
      const usdValue = safeNum(swap?.usdValue) || 0;

      const tokenInObj = swap?.tokenInputs?.[0] || swap?.nativeInput || null;
      const tokenOutObj = swap?.tokenOutputs?.[0] || swap?.nativeOutput || null;

      const inSymRaw = pickSymbolFromToken(tokenInObj);
      const outSymRaw = pickSymbolFromToken(tokenOutObj);

      const inputSym = inSymRaw ? normalizeSymbol(inSymRaw) : null;
      const outputSym = outSymRaw ? normalizeSymbol(outSymRaw) : null;

      const inputAmt = tokenInObj ? pickAmountFromToken(tokenInObj) : 0;
      const outputAmt = tokenOutObj ? pickAmountFromToken(tokenOutObj) : 0;

      if (!signature || !ts) return null;

      return {
        ts,
        signature,
        usdValue,
        inputSym,
        outputSym,
        inputAmt,
        outputAmt,
      };
    })
    .filter(Boolean) as Array<{
    ts: number;
    signature: string;
    usdValue: number;
    inputSym: string | null;
    outputSym: string | null;
    inputAmt: number;
    outputAmt: number;
  }>;
}

function computeFromSwaps(swaps: ReturnType<typeof parseHeliusSwaps>) {
  const lotsBySymbol = new Map<string, Lot[]>();
  const trades: Trade[] = [];

  let realizedPnl = 0;
  let realizedWins = 0;
  let realizedLosses = 0;
  let sumWinUsd = 0;
  let sumLossUsd = 0;
  let sumHoldHours = 0;
  let realizedCount = 0;

  const ordered = [...swaps].sort((a, b) => a.ts - b.ts);

  for (const s of ordered) {
    const tradedToken = chooseTradedToken(s.inputSym, s.outputSym);

    const inputSym = s.inputSym ? normalizeSymbol(s.inputSym) : null;
    const outputSym = s.outputSym ? normalizeSymbol(s.outputSym) : null;

    const receivesToken = outputSym === tradedToken;
    const sendsToken = inputSym === tradedToken;

    const qty = receivesToken ? s.outputAmt : sendsToken ? s.inputAmt : 0;
    const usd = s.usdValue > 0 ? s.usdValue : 0;

    if (qty <= 0 || usd <= 0) continue;

    const price = usd / qty;

    if (receivesToken && !sendsToken) {
      // BUY
      const lots = lotsBySymbol.get(tradedToken) || [];
      lots.push({ qty, costUsd: usd, ts: s.ts });
      lotsBySymbol.set(tradedToken, lots);

      trades.push({
        id: s.signature,
        symbol: tradedToken,
        side: "BUY",
        usd: Math.round(usd),
        entry: price,
        exit: price,
        pnlUsd: 0,
        pnlPct: 0,
        timeInHours: 0,
        missedUpsideUsd: 0,
        ateDrawdownUsd: 0,
      });
    } else if (sendsToken && !receivesToken) {
      // SELL
      const lots = lotsBySymbol.get(tradedToken) || [];
      let remaining = qty;

      let costUsed = 0;
      let oldestLotTs = 0;

      while (remaining > 1e-12 && lots.length) {
        const lot = lots[0];
        if (!oldestLotTs) oldestLotTs = lot.ts;

        const takeQty = Math.min(lot.qty, remaining);
        const takeCost = (lot.costUsd * takeQty) / lot.qty;

        costUsed += takeCost;
        lot.qty -= takeQty;
        lot.costUsd -= takeCost;
        remaining -= takeQty;

        if (lot.qty <= 1e-12) lots.shift();
      }

      lotsBySymbol.set(tradedToken, lots);

      let pnlUsd = 0;
      let pnlPct = 0;
      let holdHours = 0;

      if (costUsed > 0) {
        pnlUsd = usd - costUsed;
        pnlPct = (pnlUsd / costUsed) * 100;
        realizedPnl += pnlUsd;

        realizedCount += 1;

        if (pnlUsd >= 0) {
          realizedWins += 1;
          sumWinUsd += pnlUsd;
        } else {
          realizedLosses += 1;
          sumLossUsd += Math.abs(pnlUsd);
        }

        if (oldestLotTs) {
          holdHours = Math.max(0, Math.round((s.ts - oldestLotTs) / 3600));
          sumHoldHours += holdHours;
        }
      }

      trades.push({
        id: s.signature,
        symbol: tradedToken,
        side: "SELL",
        usd: Math.round(usd),
        entry: costUsed > 0 ? costUsed / qty : price,
        exit: price,
        pnlUsd,
        pnlPct: clamp(pnlPct, -99.99, 9999),
        timeInHours: holdHours,
        missedUpsideUsd: 0,
        ateDrawdownUsd: 0,
      });
    }
  }

  const winRate = realizedCount ? Math.round((realizedWins / realizedCount) * 100) : 0;
  const avgHoldHours = realizedCount ? Math.round(sumHoldHours / realizedCount) : 0;
  const avgWinUsd = realizedWins ? sumWinUsd / realizedWins : 0;
  const avgLossUsd = realizedLosses ? sumLossUsd / realizedLosses : 0;

  return {
    trades,
    realizedPnl,
    winRate,
    avgHoldHours,
    avgWinUsd,
    avgLossUsd,
    realizedCount,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").trim();
  const range = (url.searchParams.get("range") || "30D").toUpperCase();

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) {
    return NextResponse.json(
      { error: "Missing HELIUS_API_KEY. Add it to .env.local then restart your dev server." },
      { status: 500 }
    );
  }

  // IMPORTANT: Enhanced endpoint does NOT accept limit. Use before pagination later.
  // For now: fetch without limit (Helius returns a default page size)
  const heliusUrl = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${heliusKey}`;

  let txs: any[] = [];
  try {
    const r = await fetch(heliusUrl, { cache: "no-store" });
    if (!r.ok) {
      const txt = await r.text();
      return NextResponse.json({ error: `Helius error ${r.status}: ${txt}` }, { status: 500 });
    }
    txs = await r.json();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to fetch Helius data" }, { status: 500 });
  }

  const swaps = parseHeliusSwaps(Array.isArray(txs) ? txs : []);
  const computed = computeFromSwaps(swaps);

  const realizedSells = computed.trades.filter((t) => t.side === "SELL" && t.pnlUsd !== 0);

  const topTrades = [...realizedSells].sort((a, b) => b.pnlUsd - a.pnlUsd).slice(0, 5);
  const worstTrades = [...realizedSells].sort((a, b) => a.pnlUsd - b.pnlUsd).slice(0, 5);

  const biggestWin = topTrades[0] || null;
  const biggestLoss = worstTrades[0] || null;

  const tips = buildTips({
    realizedPnl: computed.realizedPnl,
    winRate: computed.winRate,
    avgWinUsd: computed.avgWinUsd,
    avgLossUsd: computed.avgLossUsd,
    trades: computed.trades.length,
    realizedTrades: computed.realizedCount,
  });

  const summary = {
    address: fmtAddress(address),
    range,
    realizedPnl: computed.realizedPnl,
    winRate: computed.winRate,
    trades: computed.trades.length,
    avgHoldHours: computed.avgHoldHours,
    avgWinUsd: computed.avgWinUsd,
    avgLossUsd: computed.avgLossUsd,
    missedUpsideTotal: 0,
    ateDrawdownTotal: 0,
    biggestWin,
    biggestLoss,
  };

  return NextResponse.json({
    address,
    summary,
    topTrades,
    worstTrades,
    missed: {
      soldEarlyTotal: 0,
      boughtLateTotal: 0,
      earlySells: [],
      lateBuys: [],
    },
    tips,
    meta: {
      source: "helius_enhanced",
      txFetched: Array.isArray(txs) ? txs.length : 0,
      swapsDetected: swaps.length,
      realizedSells: realizedSells.length,
      note: "PnL is real for SELLs (FIFO using swap usdValue). Missed-money requires candle data (Phase 2).",
    },
  });
}
