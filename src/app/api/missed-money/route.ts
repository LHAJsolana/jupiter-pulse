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

  slippageBps?: number;
  source: "events.swap" | "type.SWAP";
};

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

  const inputMint =
    outgoing?.mint || outgoing?.tokenMint || outgoing?.mintAddress || null;
  const outputMint =
    incoming?.mint || incoming?.tokenMint || incoming?.mintAddress || null;

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

      const slippageBps =
        safeNum(swap?.slippageBps) ||
        safeNum(swap?.slippage_bps) ||
        safeNum(swap?.slippage) ||
        0;

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
        slippageBps: slippageBps > 0 ? slippageBps : undefined,
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
          return {
            ok: false as const,
            status: rr.status,
            errorText: rtxt,
            txs: [] as any[],
            pages,
            supportsLimit,
            supportsBefore,
          };
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

      return {
        ok: false as const,
        status: r.status,
        errorText: txt,
        txs: [] as any[],
        pages,
        supportsLimit,
        supportsBefore,
      };
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

function estimateRoutingLeakUsd(s: SwapLike) {
  if (!s.priced || s.usdValue <= 0) return 0;
  const usd = s.usdValue;

  if (typeof s.slippageBps === "number" && s.slippageBps > 0) {
    // treat anything above 0.50% as potentially avoidable (v1)
    const avoidableBps = Math.max(0, s.slippageBps - 50);
    const leak = (usd * avoidableBps) / 10_000;
    return Math.min(leak, usd * 0.05);
  }

  if (usd >= 200) return Math.min(usd * 0.003, usd * 0.05);
  return 0;
}

/**
 * Limit Orders v1 (execution-efficiency):
 * If the swap shows meaningful slippage, we estimate a conservative limit that would reduce it.
 * This does NOT require historical candles.
 */
function estimateLimitMissUsd(s: SwapLike) {
  if (!s.priced || s.usdValue <= 0) return 0;
  const usd = s.usdValue;

  if (typeof s.slippageBps === "number" && s.slippageBps > 0) {
    const excess = Math.max(0, s.slippageBps - 30);
    const recaptureBps = excess * 0.6;
    const recaptureUsd = (usd * recaptureBps) / 10_000;
    return Math.min(recaptureUsd, usd * 0.03);
  }

  if (usd >= 400) return Math.min(usd * 0.0015, usd * 0.03);
  return 0;
}

function fmtPair(s: SwapLike) {
  const a = s.inputSym ? normalizeSymbol(s.inputSym) : "UNK";
  const b = s.outputSym ? normalizeSymbol(s.outputSym) : "UNK";
  return `${a} → ${b}`;
}

/**
 * Perps detection scaffold:
 * We do NOT compute borrow fees yet (needs perps position/borrow-rate data).
 * But we can reliably flag that perps activity exists using Helius enriched fields.
 */
function detectPerpsTxs(txs: any[]) {
  const hits: Array<{ ts: number; signature: string; why: string }> = [];

  for (const tx of txs) {
    const ts = safeNum(tx?.timestamp) || 0;
    const signature = String(tx?.signature || "");
    if (!ts || !signature) continue;

    const type = String(tx?.type || "").toLowerCase();
    const source = String(tx?.source || "").toLowerCase();
    const desc = String(tx?.description || "").toLowerCase();

    // Conservative keyword-based detection (safe, no hardcoded program IDs yet)
    const looksPerps =
      desc.includes("perp") ||
      desc.includes("perps") ||
      desc.includes("jupiter perps") ||
      source.includes("perp") ||
      source.includes("jupiter") && desc.includes("position") ||
      type.includes("perp") ||
      type.includes("margin");

    if (!looksPerps) continue;

    const why = desc
      ? `desc:${desc.slice(0, 80)}`
      : source
        ? `source:${source}`
        : type
          ? `type:${type}`
          : "keyword-match";

    hits.push({ ts, signature, why });
  }

  // Most recent first for sampling
  hits.sort((a, b) => b.ts - a.ts);
  return hits;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = (searchParams.get("wallet") || "").trim();
  const daysRaw = Number(searchParams.get("days") || "30");
  const days = daysRaw === 7 ? 7 : 30;

  if (!wallet || wallet.length < 32) {
    return NextResponse.json({ error: "Invalid wallet parameter." }, { status: 400 });
  }

  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) {
    return NextResponse.json(
      { error: "Missing HELIUS_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  const desired = days === 7 ? 260 : 900;

  const fetched = await fetchHeliusTransactions({
    address: wallet,
    apiKey: heliusKey,
    desired,
  });

  if (!fetched.ok) {
    return NextResponse.json(
      { error: `Helius error ${fetched.status}: ${fetched.errorText}` },
      { status: 500 }
    );
  }

  const txs = fetched.txs || [];

  const nowSec = Math.floor(Date.now() / 1000);
  const cutoffSec = nowSec - days * 24 * 3600;

  // Restrict raw tx window (for perps detection too)
  const windowedTxs = Array.isArray(txs)
    ? txs.filter((t: any) => safeNum(t?.timestamp) >= cutoffSec)
    : [];

  const { swaps } = await parseHeliusSwaps(windowedTxs, wallet);

  const pricedSwaps = swaps.filter((s) => s.priced && s.usdValue > 0);
  const unpricedSwaps = swaps.length - pricedSwaps.length;

  // Routing events
  const routingEvents = pricedSwaps
    .map((s) => {
      const missedUsd = estimateRoutingLeakUsd(s);
      return {
        ts: s.ts * 1000,
        type: "routing" as const,
        title: `Routing leakage on ${fmtPair(s)}`,
        detail:
          typeof s.slippageBps === "number"
            ? `Swap had ~${(s.slippageBps / 100).toFixed(2)}% slippage. Estimated avoidable portion above 0.50%.`
            : "No explicit slippage found; using conservative routing inefficiency estimate.",
        missedUsd,
        usd: s.usdValue,
      };
    })
    .filter((e) => e.missedUsd > 0.01)
    .sort((a, b) => b.missedUsd - a.missedUsd)
    .slice(0, 30);

  const routingMissed = routingEvents.reduce((sum, e) => sum + e.missedUsd, 0);

  // Limit v1 events
  const limitEvents = pricedSwaps
    .map((s) => {
      const missedUsd = estimateLimitMissUsd(s);
      return {
        ts: s.ts * 1000,
        type: "limit" as const,
        title: `Limit order edge on ${fmtPair(s)}`,
        detail:
          typeof s.slippageBps === "number"
            ? "Swap slippage suggests a conservative limit could improve execution (v1 estimate)."
            : "No explicit slippage found; using conservative limit edge estimate.",
        missedUsd,
        usd: s.usdValue,
      };
    })
    .filter((e) => e.missedUsd > 0.01)
    .sort((a, b) => b.missedUsd - a.missedUsd)
    .slice(0, 30);

  const limitMissed = limitEvents.reduce((sum, e) => sum + e.missedUsd, 0);

  // Perps scaffold (no $ yet)
  const perpsHits = detectPerpsTxs(windowedTxs);
  const perpsEvents = perpsHits.slice(0, 12).map((p) => ({
    ts: p.ts * 1000,
    type: "borrow" as const,
    title: "Perps activity detected (borrow fees module next)",
    detail: `Signature ${p.signature.slice(0, 10)}… · ${p.why}. Borrow-fee calculation pending.`,
    missedUsd: 0,
  }));

  const perpsMissed = 0;

  const total = routingMissed + limitMissed + perpsMissed;

  const response = {
    wallet,
    rangeDays: days,
    totalMissedUsd: Number(total.toFixed(2)),
    modules: [
      {
        key: "routing",
        title: "Routing Leakage",
        missedUsd: Number(routingMissed.toFixed(2)),
        note:
          pricedSwaps.length === 0
            ? `No priced swaps detected in ${days}d (token→token swaps may be unpriced).`
            : `Analyzed ${pricedSwaps.length} priced swaps (${unpricedSwaps} unpriced).`,
      },
      {
        key: "limit",
        title: "Limit Orders (v1)",
        missedUsd: Number(limitMissed.toFixed(2)),
        note: "Execution-efficiency estimate using swap slippage. (Fill-window logic later.)",
      },
      {
        // keep key as "funding" so you don't break any existing UI assumptions
        key: "funding",
        title: "Perps Borrow Fees",
        missedUsd: 0,
        note:
          perpsHits.length > 0
            ? `Detected ${perpsHits.length} likely perps-related tx(s) in ${days}d. Borrow-fee calc is next.`
            : "No perps activity detected in this window (or not identifiable via enriched fields).",
      },
      {
        key: "idle",
        title: "Idle Capital",
        missedUsd: 0,
        note: "Coming next (balance-time cost).",
      },
    ],
    events: [...routingEvents, ...limitEvents]
      .sort((a, b) => b.missedUsd - a.missedUsd)
      .slice(0, 60)
      .map((e) => ({
        ts: e.ts,
        type: e.type,
        title: e.title,
        detail: `${e.detail} (swap ~$${Math.round(e.usd).toLocaleString()})`,
        missedUsd: Number(e.missedUsd.toFixed(2)),
      }))
      .concat(perpsEvents)
      .slice(0, 60),
    meta: {
      txFetched: Array.isArray(txs) ? txs.length : 0,
      windowedTx: windowedTxs.length,
      swapsDetected: swaps.length,
      pricedSwaps: pricedSwaps.length,
      unpricedSwaps,
      perpsTxCount: perpsHits.length,
      perpsSampleSig: perpsHits[0]?.signature || null,
      supportsLimit: fetched.supportsLimit,
      supportsBefore: fetched.supportsBefore,
      note:
        "Perps Borrow Fees module is scaffolded: we detect perps tx presence first, then we’ll compute borrow-cost using perps position + rate data (Jupiter-native).",
    },
  };

  return NextResponse.json(response, { status: 200 });
}
