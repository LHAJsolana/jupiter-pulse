// src/app/api/wallets/[address]/route.ts
import { NextResponse } from "next/server";
import { getSolPriceUsd } from "@/lib/candles";

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

type Lot = { qty: number; costUsd: number; ts: number };

const COMMON_BASES = new Set(["SOL", "WSOL", "USDC", "USDT"]);
const STABLES = new Set(["USDC", "USDT"]);

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

function fmtPair(s: SwapLike) {
  const a = s.inputSym ? normalizeSymbol(s.inputSym) : "UNK";
  const b = s.outputSym ? normalizeSymbol(s.outputSym) : "UNK";
  return `${a} → ${b}`;
}

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
          return { ok: false as const, status: rr.status, errorText: rtxt, txs: [] as any[], pages };
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

      return { ok: false as const, status: r.status, errorText: txt, txs: [] as any[], pages };
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

  return { ok: true as const, txs, pages };
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

  return { swaps: out };
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

function computeStatsFromSwaps(swaps: SwapLike[]) {
  // FIFO lots per traded token, same logic style as wallet-review
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

    // BUY: receives traded token
    if (receives && !sends) {
      const lots = lotsBySymbol.get(traded) || [];
      lots.push({ qty, costUsd: s.usdValue, ts: s.ts });
      lotsBySymbol.set(traded, lots);
    }

    // SELL: sends traded token
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
  { params }: { params: { address: string } }
) {
  const { address } = params;

  if (!address || address.length < 32) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) {
    return NextResponse.json(
      { error: "Missing HELIUS_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  // Fetch enough to build “recent activity” + stats (30d-ish)
  const desired = 600;
  const fetched = await fetchHeliusTransactions({ address, apiKey: heliusKey, desired });

  if (!fetched.ok) {
    return NextResponse.json(
      { error: `Helius error ${fetched.status}: ${fetched.errorText}` },
      { status: 500 }
    );
  }

  const txs = fetched.txs || [];
  const { swaps } = await parseHeliusSwaps(Array.isArray(txs) ? txs : [], address);

  // Last 30 days window
  const nowSec = Math.floor(Date.now() / 1000);
  const cutoffSec = nowSec - 30 * 24 * 3600;

  const windowed = swaps.filter((s) => s.ts >= cutoffSec);

  const stats = computeStatsFromSwaps(windowed);

  // Recent activity = latest swaps (priced preferred)
  const sortedDesc = [...windowed].sort((a, b) => b.ts - a.ts);
  const recent = sortedDesc.slice(0, 20).map((s) => {
    const traded = chooseTradedToken(s.inputSym, s.outputSym);
    const side =
      s.outputSym && normalizeSymbol(s.outputSym) === traded ? "BUY" : "SELL";

    return {
      symbol: fmtPair(s), // keep UI compatible (string)
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
      winRate: stats.winRate, // based on realized sells where we could infer USD
      trades: stats.trades,
    },
    activity: recent,
    meta: {
      range: "30D",
      txFetched: Array.isArray(txs) ? txs.length : 0,
      swapsDetected: windowed.length,
      realizedSells: stats.realizedCount,
      note:
        "WinRate is computed from realized sells where USD value can be inferred (best when swaps include SOL/USDC/USDT legs).",
    },
  });
}
