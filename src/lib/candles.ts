// src/lib/candles.ts
type PricePoint = { ts: number; price: number }; // ts in ms

// Very small in-memory cache (good enough for local/dev)
const cache = new Map<string, { ts: number; data: any }>();
const TTL_MS = 30_000;

function getCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > TTL_MS) return null;
  return hit.data as T;
}
function setCache(key: string, data: any) {
  cache.set(key, { ts: Date.now(), data });
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Jupiter price v2 fetch:
 * https://api.jup.ag/price/v2?ids=SOL,JUP...
 *
 * Returns map: id -> priceUsd (number)
 */
export async function getJupPricesUsd(params: {
  ids: string[];
  maxAgeMs?: number;
}): Promise<{ ok: true; prices: Record<string, number> } | { ok: false; error: string }> {
  const ids = Array.from(new Set((params.ids || []).map((x) => String(x || "").trim()).filter(Boolean)));
  if (!ids.length) return { ok: false, error: "No ids provided" };

  const cacheKey = `jup_price_v2:${ids.sort().join(",")}`;
  const cached = getCache<{ prices: Record<string, number> }>(cacheKey);

  const maxAge = typeof params.maxAgeMs === "number" ? Math.max(0, params.maxAgeMs) : TTL_MS;
  if (cached && Date.now() - (cache.get(cacheKey)?.ts || 0) <= maxAge) {
    return { ok: true, prices: cached.prices };
  }

  try {
    const url = `https://api.jup.ag/price/v2?ids=${encodeURIComponent(ids.join(","))}`;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    if (!res.ok) return { ok: false, error: `Jupiter price error ${res.status}: ${text}` };

    const json = JSON.parse(text);
    const out: Record<string, number> = {};

    // expected shape: { data: { SOL: { price: 123.4 }, ... } }
    const data = json?.data || {};
    for (const id of ids) {
      const p = safeNum(data?.[id]?.price);
      if (p > 0) out[id] = p;
    }

    setCache(cacheKey, { prices: out });
    return { ok: true, prices: out };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to fetch Jupiter prices" };
  }
}

/**
 * Convenience: SOL spot price in USD via Jupiter price v2
 */
export async function getSolPriceUsd(): Promise<number> {
  const res = await getJupPricesUsd({ ids: ["SOL"], maxAgeMs: 10_000 });
  if (!res.ok) return 0;
  const p = safeNum(res.prices["SOL"]);
  return p > 0 ? p : 0;
}

/**
 * Phase 2 warmup helper:
 * sample spot prices N times with a fixed gap.
 * NOTE: this is NOT candles — just repeated spot snapshots.
 */
export async function sampleSpotWindow(params: {
  ids: string[];
  samples: number; // e.g. 4
  gapMs: number; // e.g. 900
}): Promise<
  | { ok: true; points: Array<{ atMs: number; prices: Record<string, number> }> }
  | { ok: false; points: Array<{ atMs: number; prices: Record<string, number> }>; error: string }
> {
  const ids = Array.from(new Set((params.ids || []).map((x) => String(x || "").trim()).filter(Boolean)));
  const samples = Math.max(1, Math.min(20, Math.floor(params.samples || 1)));
  const gapMs = Math.max(0, Math.min(30_000, Math.floor(params.gapMs || 0)));

  const points: Array<{ atMs: number; prices: Record<string, number> }> = [];

  let lastErr: string | null = null;

  for (let i = 0; i < samples; i++) {
    const atMs = Date.now();
    const snap = await getJupPricesUsd({ ids, maxAgeMs: 0 }); // force fresh
    if (snap.ok) {
      points.push({ atMs, prices: snap.prices });
    } else {
      lastErr = snap.error;
      points.push({ atMs, prices: {} });
    }

    if (i < samples - 1 && gapMs > 0) await sleep(gapMs);
  }

  if (lastErr) return { ok: false, points, error: lastErr };
  return { ok: true, points };
}

/* ------------------------------------------------------------------
   Legacy CoinGecko candle helpers (kept so you don’t break other pages)
   If you truly want ZERO CoinGecko usage anywhere, tell me and we’ll
   remove these + update any callers.
------------------------------------------------------------------- */

type CGPricePoint = [number, number]; // [ms, price]
const CG = "https://api.coingecko.com/api/v3";

async function cgFetch<T>(url: string): Promise<T> {
  const cached = getCache<T>(url);
  if (cached) return cached;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CoinGecko error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as T;
  setCache(url, data);
  return data;
}

/**
 * Get dense price series between [from,to] (unix seconds)
 */
export async function getPriceSeriesRange(params: {
  coinId: string;
  vsCurrency?: string;
  fromSec: number;
  toSec: number;
}): Promise<CGPricePoint[]> {
  const { coinId, vsCurrency = "usd", fromSec, toSec } = params;

  const url =
    `${CG}/coins/${encodeURIComponent(coinId)}/market_chart/range` +
    `?vs_currency=${encodeURIComponent(vsCurrency)}` +
    `&from=${fromSec}&to=${toSec}`;

  const data = await cgFetch<{ prices: CGPricePoint[] }>(url);
  return Array.isArray(data?.prices) ? data.prices : [];
}

/**
 * Get OHLC candles for a window (days = 1,7,14,30,90,180,365,max)
 */
export async function getOhlc(params: {
  coinId: string;
  days: 1 | 7 | 14 | 30 | 90 | 180 | 365 | "max";
  vsCurrency?: string;
}): Promise<[number, number, number, number, number][]> {
  const { coinId, days, vsCurrency = "usd" } = params;

  const url =
    `${CG}/coins/${encodeURIComponent(coinId)}/ohlc` +
    `?vs_currency=${encodeURIComponent(vsCurrency)}` +
    `&days=${days}`;

  return await cgFetch(url);
}
