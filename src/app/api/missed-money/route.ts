import { NextResponse } from "next/server";
import {
  fetchHeliusTransactions,
  fmtPair,
  parseHeliusSwaps,
  safeNum,
  type SwapLike,
} from "@/lib/walletSwaps";

type EventItem = {
  ts: number;
  type: "routing" | "limit" | "borrow";
  title: string;
  detail: string;
  missedUsd: number;
};

function recordOf(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function estimateRoutingLeakUsd(s: SwapLike) {
  if (!s.priced || s.usdValue <= 0) return 0;
  const usd = s.usdValue;

  if (typeof s.slippageBps === "number" && s.slippageBps > 0) {
    const avoidableBps = Math.max(0, s.slippageBps - 50);
    const leak = (usd * avoidableBps) / 10_000;
    return Math.min(leak, usd * 0.05);
  }

  if (usd >= 200) return Math.min(usd * 0.003, usd * 0.05);
  return 0;
}

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

function detectPerpsTxs(txs: unknown[]) {
  const hits: Array<{ ts: number; signature: string; why: string }> = [];

  for (const tx of txs) {
    const rec = recordOf(tx);
    const ts = safeNum(rec.timestamp) || 0;
    const signature = String(rec.signature || "");
    if (!ts || !signature) continue;

    const type = String(rec.type || "").toLowerCase();
    const source = String(rec.source || "").toLowerCase();
    const desc = String(rec.description || "").toLowerCase();

    const looksPerps =
      desc.includes("perp") ||
      desc.includes("perps") ||
      desc.includes("jupiter perps") ||
      source.includes("perp") ||
      (source.includes("jupiter") && desc.includes("position")) ||
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
    return NextResponse.json({ error: "Missing HELIUS_API_KEY in .env.local" }, { status: 500 });
  }

  const fetched = await fetchHeliusTransactions({
    address: wallet,
    apiKey: heliusKey,
    desired: days === 7 ? 260 : 900,
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
  const windowedTxs = txs.filter((tx) => safeNum(recordOf(tx).timestamp) >= cutoffSec);

  const {
    swaps,
    jupiterPriceIdsRequested,
    jupiterPriceIdsResolved,
    jupiterEnrichedSwaps,
  } = await parseHeliusSwaps(windowedTxs, wallet);

  const pricedSwaps = swaps.filter((s) => s.priced && s.usdValue > 0);
  const unpricedSwaps = swaps.length - pricedSwaps.length;

  const routingEvents: EventItem[] = pricedSwaps
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
    .slice(0, 30)
    .map((e) => ({
      ts: e.ts,
      type: e.type,
      title: e.title,
      detail: `${e.detail} (swap ~$${Math.round(e.usd).toLocaleString()})`,
      missedUsd: Number(e.missedUsd.toFixed(2)),
    }));

  const routingMissed = routingEvents.reduce((sum, e) => sum + e.missedUsd, 0);

  const limitEvents: EventItem[] = pricedSwaps
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
    .slice(0, 30)
    .map((e) => ({
      ts: e.ts,
      type: e.type,
      title: e.title,
      detail: `${e.detail} (swap ~$${Math.round(e.usd).toLocaleString()})`,
      missedUsd: Number(e.missedUsd.toFixed(2)),
    }));

  const limitMissed = limitEvents.reduce((sum, e) => sum + e.missedUsd, 0);

  const perpsHits = detectPerpsTxs(windowedTxs);
  const perpsEvents: EventItem[] = perpsHits.slice(0, 12).map((p) => ({
    ts: p.ts * 1000,
    type: "borrow",
    title: "Perps activity detected (borrow fees module next)",
    detail: `Signature ${p.signature.slice(0, 10)}... ${p.why}. Borrow-fee calculation pending.`,
    missedUsd: 0,
  }));

  const events: EventItem[] = [...routingEvents, ...limitEvents, ...perpsEvents]
    .sort((a, b) => b.missedUsd - a.missedUsd)
    .slice(0, 60);

  return NextResponse.json(
    {
      wallet,
      rangeDays: days,
      totalMissedUsd: Number((routingMissed + limitMissed).toFixed(2)),
      modules: [
        {
          key: "routing",
          title: "Routing Leakage",
          missedUsd: Number(routingMissed.toFixed(2)),
          note:
            pricedSwaps.length === 0
              ? `No priced swaps detected in ${days}d (token-to-token swaps may be unpriced).`
              : `Analyzed ${pricedSwaps.length} priced swaps (${unpricedSwaps} unpriced).`,
        },
        {
          key: "limit",
          title: "Limit Orders (v1)",
          missedUsd: Number(limitMissed.toFixed(2)),
          note: "Execution-efficiency estimate using swap slippage. (Fill-window logic later.)",
        },
        {
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
      events,
      meta: {
        txFetched: txs.length,
        windowedTx: windowedTxs.length,
        swapsDetected: swaps.length,
        pricedSwaps: pricedSwaps.length,
        unpricedSwaps,
        jupiterPriceIdsRequested,
        jupiterPriceIdsResolved,
        jupiterEnrichedSwaps,
        perpsTxCount: perpsHits.length,
        perpsSampleSig: perpsHits[0]?.signature || null,
        supportsLimit: fetched.supportsLimit,
        supportsBefore: fetched.supportsBefore,
        note:
          "Perps Borrow Fees module is scaffolded: we detect perps tx presence first, then compute borrow-cost later.",
      },
    },
    { status: 200 }
  );
}
