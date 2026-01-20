// src/app/api/wallet-review/route.ts
import { NextResponse } from "next/server";
import { getSolPriceUsd, sampleSpotWindow } from "@/lib/candles";

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

type Lot = { qty: number; costUsd: number; ts: number };

type SwapLike = {
  ts: number;
  signature: string;

  inputSym: string | null;
  outputSym: string | null;
  inputMint: string | null;
  outputMint: string | null;

  inputAmt: number;
  outputAmt: number;

  usdValue: number;
  priced: boolean;

  source: "events.swap" | "type.SWAP";
};

const COMMON_BASES = new Set(["SOL", "WSOL", "USDC", "USDT"]);
const STABLES = new Set(["USDC", "USDT"]);

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtAddress(a: string) {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function normalizeSymbol(sym: string) {
  const s = (sym || "").toUpperCase();
  return s === "WSOL" ? "SOL" : s;
}

function pickSymbolFromToken(token: any): string | null {
  const sym = token?.symbol;
  if (typeof sym === "string" && sym.trim()) return normalizeSymbol(sym.trim());
  const sym2 = token?.tokenSymbol;
  if (typeof sym2 === "string" && sym2.trim()) return normalizeSymbol(sym2.trim());
  return null;
}

function pickMintFromToken(token: any): string | null {
  const m =
    token?.mint ||
    token?.mintAddress ||
    token?.tokenMint ||
    token?.rawTokenAmount?.tokenMint ||
    null;
  return typeof m === "string" && m.length > 20 ? m : null;
}

function pickAmountFromToken(token: any): number {
  return (
    safeNum(token?.tokenAmount) ||
    safeNum(token?.amount) ||
    safeNum(token?.rawTokenAmount?.tokenAmount) ||
    0
  );
}

function isStable(sym?: string | null) {
  if (!sym) return false;
  return STABLES.has(normalizeSymbol(sym));
}

function isSOL(sym?: string | null) {
  if (!sym) return false;
  return normalizeSymbol(sym) === "SOL";
}

function chooseTradedToken(inputSym?: string | null, outputSym?: string | null) {
  const a = inputSym ? normalizeSymbol(inputSym) : null;
  const b = outputSym ? normalizeSymbol(outputSym) : null;

  if (a && !COMMON_BASES.has(a)) return a;
  if (b && !COMMON_BASES.has(b)) return b;

  if (a === "SOL") return "SOL";
  if (b === "SOL") return "SOL";

  return a || b || "UNK";
}

function inferLegsFromTransfers(tx: any, walletAddress: string) {
  const addr = walletAddress;
  const transfers = Array.isArray(tx?.tokenTransfers) ? tx.tokenTransfers : [];

  const outgoing = transfers
    .filter((t: any) => String(t?.fromUserAccount || "") === addr)
    .sort((a: any, b: any) => safeNum(b?.tokenAmount) - safeNum(a?.tokenAmount))[0];

  const incoming = transfers
    .filter((t: any) => String(t?.toUserAccount || "") === addr)
    .sort((a: any, b: any) => safeNum(b?.tokenAmount) - safeNum(a?.tokenAmount))[0];

  const inputSym = outgoing
    ? normalizeSymbol(outgoing?.tokenSymbol || outgoing?.symbol || "UNK")
    : null;
  const outputSym = incoming
    ? normalizeSymbol(incoming?.tokenSymbol || incoming?.symbol || "UNK")
    : null;

  const inputMint = outgoing?.mint || outgoing?.tokenMint || outgoing?.mintAddress || null;
  const outputMint = incoming?.mint || incoming?.tokenMint || incoming?.mintAddress || null;

  const inputAmt = outgoing ? safeNum(outgoing?.tokenAmount) : 0;
  const outputAmt = incoming ? safeNum(incoming?.tokenAmount) : 0;

  return {
    inputSym,
    outputSym,
    inputMint: typeof inputMint === "string" ? inputMint : null,
    outputMint: typeof outputMint === "string" ? outputMint : null,
    inputAmt,
    outputAmt,
  };
}

function inferUsdValue(params: {
  inputSym: string | null;
  outputSym: string | null;
  inputAmt: number;
  outputAmt: number;
  solPrice: number;
  directUsdValue?: number;
}) {
  const { inputSym, outputSym, inputAmt, outputAmt, solPrice, directUsdValue } = params;

  const direct = safeNum(directUsdValue);
  if (direct > 0) return { usdValue: direct, priced: true };

  if (isStable(inputSym) && inputAmt > 0) return { usdValue: inputAmt, priced: true };
  if (isStable(outputSym) && outputAmt > 0) return { usdValue: outputAmt, priced: true };

  if (solPrice > 0) {
    if (isSOL(inputSym) && inputAmt > 0) return { usdValue: inputAmt * solPrice, priced: true };
    if (isSOL(outputSym) && outputAmt > 0) return { usdValue: outputAmt * solPrice, priced: true };
  }

  return { usdValue: 0, priced: false };
}

async function parseHeliusSwaps(txs: any[], walletAddress: string) {
  const solPrice = await getSolPriceUsd();
  const out: SwapLike[] = [];

  for (const tx of txs) {
    const ts = safeNum(tx?.timestamp) || 0;
    const signature = String(tx?.signature || "");
    if (!ts || !signature) continue;

    const swap = tx?.events?.swap;
    if (swap) {
      const directUsdValue = safeNum(swap?.usdValue);

      const tokenInObj = swap?.tokenInputs?.[0] || swap?.nativeInput || null;
      const tokenOutObj = swap?.tokenOutputs?.[0] || swap?.nativeOutput || null;

      const inputSym = tokenInObj ? pickSymbolFromToken(tokenInObj) : null;
      const outputSym = tokenOutObj ? pickSymbolFromToken(tokenOutObj) : null;

      const inputMint = tokenInObj ? pickMintFromToken(tokenInObj) : null;
      const outputMint = tokenOutObj ? pickMintFromToken(tokenOutObj) : null;

      const inputAmt = tokenInObj ? pickAmountFromToken(tokenInObj) : 0;
      const outputAmt = tokenOutObj ? pickAmountFromToken(tokenOutObj) : 0;

      const inferred = inferUsdValue({
        inputSym,
        outputSym,
        inputAmt,
        outputAmt,
        solPrice,
        directUsdValue,
      });

      if ((inputAmt <= 0 && outputAmt <= 0) || (!inputSym && !outputSym)) continue;

      out.push({
        ts,
        signature,
        inputSym,
        outputSym,
        inputMint,
        outputMint,
        inputAmt,
        outputAmt,
        usdValue: inferred.usdValue,
        priced: inferred.priced,
        source: "events.swap",
      });

      continue;
    }

    if (String(tx?.type || "").toUpperCase() === "SWAP") {
      const legs = inferLegsFromTransfers(tx, walletAddress);

      const inferred = inferUsdValue({
        inputSym: legs.inputSym,
        outputSym: legs.outputSym,
        inputAmt: legs.inputAmt,
        outputAmt: legs.outputAmt,
        solPrice,
        directUsdValue: 0,
      });

      out.push({
        ts,
        signature,
        inputSym: legs.inputSym,
        outputSym: legs.outputSym,
        inputMint: legs.inputMint,
        outputMint: legs.outputMint,
        inputAmt: legs.inputAmt,
        outputAmt: legs.outputAmt,
        usdValue: inferred.usdValue,
        priced: inferred.priced,
        source: "type.SWAP",
      });
    }
  }

  return { swaps: out, solPrice };
}

function computeFromSwaps(swaps: SwapLike[]) {
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

function buildTips(summary: {
  winRate: number;
  avgWinUsd: number;
  avgLossUsd: number;
  realizedTrades: number;
  pricedSwaps: number;
  unpricedSwaps: number;
}) {
  const tips: string[] = [];

  if (summary.pricedSwaps === 0 && summary.unpricedSwaps > 0) {
    tips.push(
      "We found swaps, but many are unpriced (no USD value). This usually happens when swaps are token→token with no SOL/USDC/USDT leg."
    );
  }

  if (summary.realizedTrades < 3) tips.push("Not enough realized sells yet → need more SELLs to judge performance.");
  else {
    if (summary.avgLossUsd > summary.avgWinUsd) tips.push("Avg loss > avg win → tighten stops or take partials earlier.");
    else tips.push("Avg win > avg loss → repeat best setups and avoid overtrading.");
    if (summary.winRate < 45) tips.push("Low win rate → be more selective + reduce size.");
    if (summary.winRate > 60) tips.push("Strong win rate → scale out instead of full exits.");
  }

  tips.push("Missed-money is Phase 2 → limit/funding/idle modules will plug in progressively.");
  tips.push("Pre-plan entry/stop/targets before swapping — consistency beats speed.");

  return tips.slice(0, 6);
}

async function fetchHeliusTransactions(params: {
  address: string;
  apiKey: string;
  desired: number;
}) {
  const { address, apiKey, desired } = params;

  const base = `https://api.helius.xyz/v0/addresses/${address}/transactions`;
  const txs: any[] = [];

  let supportsLimit: boolean | null = null;
  let supportsBefore: boolean | null = null;

  let before: string | undefined = undefined;
  let pages = 0;

  const MAX_PAGES = 8;

  while (txs.length < desired && pages < MAX_PAGES) {
    pages += 1;

    const url = new URL(base);
    url.searchParams.set("api-key", apiKey);

    if (supportsLimit !== false) {
      url.searchParams.set("limit", String(Math.min(200, desired - txs.length)));
    }

    if (before && supportsBefore !== false) {
      url.searchParams.set("before", before);
    }

    const r = await fetch(url.toString(), { cache: "no-store" });
    const txt = await r.text();

    if (!r.ok) {
      const lower = txt.toLowerCase();
      const invalidLimit = lower.includes("invalid query parameter limit");

      if (invalidLimit) {
        supportsLimit = false;

        const retryUrl = new URL(base);
        retryUrl.searchParams.set("api-key", apiKey);
        if (before && supportsBefore !== false) retryUrl.searchParams.set("before", before);

        const rr = await fetch(retryUrl.toString(), { cache: "no-store" });
        const rtxt = await rr.text();
        if (!rr.ok) {
          return { ok: false as const, status: rr.status, errorText: rtxt, txs: [] as any[], pages, supportsLimit, supportsBefore };
        }

        const j = JSON.parse(rtxt);
        const batch = Array.isArray(j) ? j : [];
        txs.push(...batch);

        if (batch.length) {
          const lastSig = String(batch[batch.length - 1]?.signature || "");
          if (lastSig) before = lastSig;
        }
        continue;
      }

      const invalidBefore = lower.includes("invalid query parameter before");
      if (invalidBefore) {
        supportsBefore = false;
        continue;
      }

      return { ok: false as const, status: r.status, errorText: txt, txs: [] as any[], pages, supportsLimit, supportsBefore };
    }

    const j = JSON.parse(txt);
    const batch = Array.isArray(j) ? j : [];
    txs.push(...batch);

    if (batch.length) {
      const lastSig = String(batch[batch.length - 1]?.signature || "");
      if (lastSig) before = lastSig;
      if (supportsBefore === null) supportsBefore = true;
    } else {
      break;
    }

    if (supportsLimit === null) supportsLimit = true;
  }

  return { ok: true as const, txs, pages, supportsLimit, supportsBefore };
}

/**
 * Phase 2 Step 1 replacement:
 * We no longer prefetch CoinGecko candles.
 * We do a tiny Jupiter spot sampling (SOL) to confirm Jupiter price pipeline is alive.
 */
async function spotWarmup() {
  const sampled = await sampleSpotWindow({ ids: ["SOL"], samples: 4, gapMs: 900 });
  return {
    spotSampleOk: sampled.ok,
    spotSamples: sampled.points.length,
    spotSampleNote: sampled.ok ? "Jupiter spot sampling OK" : sampled.error,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").trim();
  const range = (url.searchParams.get("range") || "30D").toUpperCase();

  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) return NextResponse.json({ error: "Missing HELIUS_API_KEY in .env.local" }, { status: 500 });

  const desired = range === "7D" ? 200 : range === "90D" ? 700 : range === "ALL" ? 1600 : 450;

  const fetched = await fetchHeliusTransactions({ address, apiKey: heliusKey, desired });

  if (!fetched.ok) {
    return NextResponse.json(
      { error: `Helius error ${fetched.status}: ${fetched.errorText}` },
      { status: 500 }
    );
  }

  const txs = fetched.txs;

  const { swaps, solPrice } = await parseHeliusSwaps(Array.isArray(txs) ? txs : [], address);
  const computed = computeFromSwaps(swaps);

  const realizedSells = computed.trades.filter((t) => t.side === "SELL" && t.pnlUsd !== 0);
  const topTrades = [...realizedSells].sort((a, b) => b.pnlUsd - a.pnlUsd).slice(0, 5);
  const worstTrades = [...realizedSells].sort((a, b) => a.pnlUsd - b.pnlUsd).slice(0, 5);

  const pricedSwaps = swaps.filter((s) => s.priced && s.usdValue > 0).length;
  const unpricedSwaps = swaps.length - pricedSwaps;

  const warm = await spotWarmup();

  const tips = buildTips({
    winRate: computed.winRate,
    avgWinUsd: computed.avgWinUsd,
    avgLossUsd: computed.avgLossUsd,
    realizedTrades: computed.realizedCount,
    pricedSwaps,
    unpricedSwaps,
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
    biggestWin: topTrades[0] || null,
    biggestLoss: worstTrades[0] || null,
  };

  const sample = Array.isArray(txs) && txs.length ? txs[0] : null;

  return NextResponse.json({
    address,
    summary,
    topTrades,
    worstTrades,
    missed: { soldEarlyTotal: 0, boughtLateTotal: 0, earlySells: [], lateBuys: [] },
    tips,
    meta: {
      source: "helius_enhanced",
      txFetched: Array.isArray(txs) ? txs.length : 0,
      pagesFetched: fetched.pages,
      supportsLimit: fetched.supportsLimit,
      supportsBefore: fetched.supportsBefore,
      swapsDetected: swaps.length,
      pricedSwaps,
      unpricedSwaps,
      swapsFromEvents: swaps.filter((s) => s.source === "events.swap").length,
      swapsFromType: swaps.filter((s) => s.source === "type.SWAP").length,
      realizedSells: realizedSells.length,
      solPriceUsed: solPrice,
      ...warm,
      sampleTxKeys: sample ? Object.keys(sample) : [],
      sampleHasEventsSwap: !!sample?.events?.swap,
      sampleType: sample?.type || null,
      note:
        "CoinGecko candles removed. Using Jupiter spot sampling for Phase 2 pipeline warmup. Missed-money calculations will live in /api/missed-money.",
    },
  });
}
