import { getJupPricesUsd, getSolPriceUsd } from "@/lib/candles";

export type SwapLike = {
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

export type HeliusFetchResult =
  | {
      ok: true;
      txs: unknown[];
      pages: number;
      supportsLimit: boolean | null;
      supportsBefore: boolean | null;
    }
  | {
      ok: false;
      status: number;
      errorText: string;
      txs: unknown[];
      pages: number;
      supportsLimit: boolean | null;
      supportsBefore: boolean | null;
    };

const COMMON_BASES = new Set(["SOL", "WSOL", "USDC", "USDT"]);
const STABLES = new Set(["USDC", "USDT"]);

export function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeSymbol(sym: string) {
  const s = (sym || "").toUpperCase();
  return s === "WSOL" ? "SOL" : s;
}

export function isStable(sym?: string | null) {
  if (!sym) return false;
  return STABLES.has(normalizeSymbol(sym));
}

export function isSOL(sym?: string | null) {
  if (!sym) return false;
  return normalizeSymbol(sym) === "SOL";
}

export function chooseTradedToken(inputSym?: string | null, outputSym?: string | null) {
  const a = inputSym ? normalizeSymbol(inputSym) : null;
  const b = outputSym ? normalizeSymbol(outputSym) : null;

  if (a && !COMMON_BASES.has(a)) return a;
  if (b && !COMMON_BASES.has(b)) return b;

  if (a === "SOL") return "SOL";
  if (b === "SOL") return "SOL";

  return a || b || "UNK";
}

export function fmtPair(s: SwapLike) {
  const a = s.inputSym ? normalizeSymbol(s.inputSym) : "UNK";
  const b = s.outputSym ? normalizeSymbol(s.outputSym) : "UNK";
  return `${a} -> ${b}`;
}

function readRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function pickSymbolFromToken(token: unknown): string | null {
  const t = readRecord(token);
  const sym = t.symbol;
  if (typeof sym === "string" && sym.trim()) return normalizeSymbol(sym.trim());

  const sym2 = t.tokenSymbol;
  if (typeof sym2 === "string" && sym2.trim()) return normalizeSymbol(sym2.trim());

  return null;
}

function pickMintFromToken(token: unknown): string | null {
  const t = readRecord(token);
  const rawTokenAmount = readRecord(t.rawTokenAmount);
  const m = t.mint || t.mintAddress || t.tokenMint || rawTokenAmount.tokenMint || null;
  return typeof m === "string" && m.length > 20 ? m : null;
}

function pickAmountFromToken(token: unknown): number {
  const t = readRecord(token);
  const rawTokenAmount = readRecord(t.rawTokenAmount);
  return safeNum(t.tokenAmount) || safeNum(t.amount) || safeNum(rawTokenAmount.tokenAmount) || 0;
}

function inferLegsFromTransfers(tx: unknown, walletAddress: string) {
  const t = readRecord(tx);
  const transfers = Array.isArray(t.tokenTransfers) ? t.tokenTransfers : [];

  const outgoing = transfers
    .filter((transfer) => String(readRecord(transfer).fromUserAccount || "") === walletAddress)
    .sort((a, b) => safeNum(readRecord(b).tokenAmount) - safeNum(readRecord(a).tokenAmount))[0];

  const incoming = transfers
    .filter((transfer) => String(readRecord(transfer).toUserAccount || "") === walletAddress)
    .sort((a, b) => safeNum(readRecord(b).tokenAmount) - safeNum(readRecord(a).tokenAmount))[0];

  const outgoingRec = readRecord(outgoing);
  const incomingRec = readRecord(incoming);

  const inputSym = outgoing
    ? normalizeSymbol(String(outgoingRec.tokenSymbol || outgoingRec.symbol || "UNK"))
    : null;
  const outputSym = incoming
    ? normalizeSymbol(String(incomingRec.tokenSymbol || incomingRec.symbol || "UNK"))
    : null;

  const inputMint = outgoingRec.mint || outgoingRec.tokenMint || outgoingRec.mintAddress || null;
  const outputMint = incomingRec.mint || incomingRec.tokenMint || incomingRec.mintAddress || null;

  return {
    inputSym,
    outputSym,
    inputMint: typeof inputMint === "string" ? inputMint : null,
    outputMint: typeof outputMint === "string" ? outputMint : null,
    inputAmt: outgoing ? safeNum(outgoingRec.tokenAmount) : 0,
    outputAmt: incoming ? safeNum(incomingRec.tokenAmount) : 0,
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

function priceLookupIds(mint?: string | null, symbol?: string | null) {
  const ids: string[] = [];
  if (mint && mint.length > 20) ids.push(mint);

  const sym = symbol ? normalizeSymbol(symbol) : null;
  if (sym && sym !== "UNK" && !isStable(sym) && !isSOL(sym)) ids.push(sym);

  return ids;
}

async function enrichSwapsWithJupiterPrices(swaps: SwapLike[]) {
  const ids = new Set<string>();

  for (const s of swaps) {
    if (s.priced && s.usdValue > 0) continue;
    if (s.inputAmt > 0) priceLookupIds(s.inputMint, s.inputSym).forEach((id) => ids.add(id));
    if (s.outputAmt > 0) priceLookupIds(s.outputMint, s.outputSym).forEach((id) => ids.add(id));
  }

  const wanted = Array.from(ids);
  if (!wanted.length) {
    return {
      swaps,
      jupiterPriceIdsRequested: 0,
      jupiterPriceIdsResolved: 0,
      jupiterEnrichedSwaps: 0,
    };
  }

  const prices: Record<string, number> = {};

  for (let i = 0; i < wanted.length; i += 50) {
    const chunk = wanted.slice(i, i + 50);
    const res = await getJupPricesUsd({ ids: chunk, maxAgeMs: 10_000 });
    if (res.ok) Object.assign(prices, res.prices);
  }

  let jupiterEnrichedSwaps = 0;
  const enriched = swaps.map((s) => {
    if (s.priced && s.usdValue > 0) return s;

    const inputPrice = priceLookupIds(s.inputMint, s.inputSym)
      .map((id) => safeNum(prices[id]))
      .find((price) => price > 0);

    if (inputPrice && s.inputAmt > 0) {
      jupiterEnrichedSwaps += 1;
      return { ...s, usdValue: s.inputAmt * inputPrice, priced: true };
    }

    const outputPrice = priceLookupIds(s.outputMint, s.outputSym)
      .map((id) => safeNum(prices[id]))
      .find((price) => price > 0);

    if (outputPrice && s.outputAmt > 0) {
      jupiterEnrichedSwaps += 1;
      return { ...s, usdValue: s.outputAmt * outputPrice, priced: true };
    }

    return s;
  });

  return {
    swaps: enriched,
    jupiterPriceIdsRequested: wanted.length,
    jupiterPriceIdsResolved: Object.keys(prices).length,
    jupiterEnrichedSwaps,
  };
}

export async function parseHeliusSwaps(txs: unknown[], walletAddress: string) {
  const solPrice = await getSolPriceUsd();
  const out: SwapLike[] = [];

  for (const tx of txs) {
    const t = readRecord(tx);
    const ts = safeNum(t.timestamp) || 0;
    const signature = String(t.signature || "");
    if (!ts || !signature) continue;

    const events = readRecord(t.events);
    const swap = readRecord(events.swap);

    if (events.swap) {
      const directUsdValue = safeNum(swap.usdValue);
      const tokenInputs = Array.isArray(swap.tokenInputs) ? swap.tokenInputs : [];
      const tokenOutputs = Array.isArray(swap.tokenOutputs) ? swap.tokenOutputs : [];
      const tokenInObj = tokenInputs[0] || swap.nativeInput || null;
      const tokenOutObj = tokenOutputs[0] || swap.nativeOutput || null;

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
        safeNum(swap.slippageBps) || safeNum(swap.slippage_bps) || safeNum(swap.slippage) || 0;

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

    if (String(t.type || "").toUpperCase() === "SWAP") {
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

  const enriched = await enrichSwapsWithJupiterPrices(out);

  return {
    swaps: enriched.swaps,
    solPrice,
    jupiterPriceIdsRequested: enriched.jupiterPriceIdsRequested,
    jupiterPriceIdsResolved: enriched.jupiterPriceIdsResolved,
    jupiterEnrichedSwaps: enriched.jupiterEnrichedSwaps,
  };
}

export async function fetchHeliusTransactions(params: {
  address: string;
  apiKey: string;
  desired: number;
}): Promise<HeliusFetchResult> {
  const { address, apiKey, desired } = params;

  const base = `https://api.helius.xyz/v0/addresses/${address}/transactions`;
  const txs: unknown[] = [];

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
            ok: false,
            status: rr.status,
            errorText: rtxt,
            txs: [],
            pages,
            supportsLimit,
            supportsBefore,
          };
        }

        const j = JSON.parse(rtxt);
        const batch = Array.isArray(j) ? j : [];
        txs.push(...batch);

        if (batch.length) {
          const lastSig = String(readRecord(batch[batch.length - 1]).signature || "");
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
        ok: false,
        status: r.status,
        errorText: txt,
        txs: [],
        pages,
        supportsLimit,
        supportsBefore,
      };
    }

    const j = JSON.parse(txt);
    const batch = Array.isArray(j) ? j : [];
    txs.push(...batch);

    if (batch.length) {
      const lastSig = String(readRecord(batch[batch.length - 1]).signature || "");
      if (lastSig) before = lastSig;
      if (supportsBefore === null) supportsBefore = true;
    } else {
      break;
    }

    if (supportsLimit === null) supportsLimit = true;
  }

  return { ok: true, txs, pages, supportsLimit, supportsBefore };
}
