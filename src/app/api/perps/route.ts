import { NextResponse } from "next/server";

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

/**
 * Perps detection v1:
 * Conservative keyword-based detection using Helius enriched fields.
 * Later we’ll harden this with program IDs + position state parsing.
 */
function detectPerpsTxs(txs: any[]) {
  const hits: Array<{
    ts: number;
    signature: string;
    kind: string;
    why: string;
  }> = [];

  for (const tx of txs) {
    const ts = safeNum(tx?.timestamp) || 0;
    const signature = String(tx?.signature || "");
    if (!ts || !signature) continue;

    const type = String(tx?.type || "").toLowerCase();
    const source = String(tx?.source || "").toLowerCase();
    const desc = String(tx?.description || "").toLowerCase();

    // keywords (safe starter)
    const looksPerps =
      desc.includes("perp") ||
      desc.includes("perps") ||
      desc.includes("jupiter perps") ||
      source.includes("perp") ||
      (source.includes("jupiter") && desc.includes("position")) ||
      type.includes("perp") ||
      type.includes("margin");

    if (!looksPerps) continue;

    let kind = "perps";
    if (desc.includes("open")) kind = "open";
    if (desc.includes("close")) kind = "close";
    if (desc.includes("liquidat")) kind = "liquidation";
    if (desc.includes("deposit")) kind = "deposit";
    if (desc.includes("withdraw")) kind = "withdraw";

    const why = desc
      ? `desc:${desc.slice(0, 120)}`
      : source
        ? `source:${source}`
        : type
          ? `type:${type}`
          : "keyword-match";

    hits.push({ ts, signature, kind, why });
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
    return NextResponse.json(
      { error: "Missing HELIUS_API_KEY in .env.local" },
      { status: 500 }
    );
  }

  const desired = days === 7 ? 300 : 1100;

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

  const windowedTxs = Array.isArray(txs)
    ? txs.filter((t: any) => safeNum(t?.timestamp) >= cutoffSec)
    : [];

  const perpsHits = detectPerpsTxs(windowedTxs);

  return NextResponse.json(
    {
      wallet,
      rangeDays: days,
      perpsTxCount: perpsHits.length,
      sample: perpsHits.slice(0, 20).map((p) => ({
        ts: p.ts * 1000,
        signature: p.signature,
        kind: p.kind,
        why: p.why,
      })),
      meta: {
        txFetched: Array.isArray(txs) ? txs.length : 0,
        windowedTx: windowedTxs.length,
        pagesFetched: fetched.pages,
        supportsLimit: fetched.supportsLimit,
        supportsBefore: fetched.supportsBefore,
        note:
          "Perps route v1: detection scaffold only (no borrow-fee math yet). Next: program-ID hardening + borrow-rate/position-state parsing.",
      },
    },
    { status: 200 }
  );
}
