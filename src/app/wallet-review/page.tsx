// src/app/wallet-review/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Trade = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  usd: number;
  pnlUsd: number;
  pnlPct: number;
  timeInHours: number;
  missedUpsideUsd: number;
  ateDrawdownUsd: number;
};

type ReviewResponse = {
  address: string;
  summary: {
    address: string;
    range: string;
    realizedPnl: number;
    winRate: number;
    trades: number;
    avgHoldHours: number;
    avgWinUsd: number;
    avgLossUsd: number;
    missedUpsideTotal: number;
    ateDrawdownTotal: number;
    biggestWin: Trade | null;
    biggestLoss: Trade | null;
  };
  topTrades: Trade[];
  worstTrades: Trade[];
  missed: {
    soldEarlyTotal: number;
    boughtLateTotal: number;
    earlySells: Trade[];
    lateBuys: Trade[];
  };
  tips: string[];
  meta?: {
    source?: string;
    txFetched?: number;
    pagesFetched?: number;
    supportsLimit?: boolean | null;
    supportsBefore?: boolean | null;
    swapsDetected?: number;
    pricedSwaps?: number;
    unpricedSwaps?: number;
    swapsFromEvents?: number;
    swapsFromType?: number;
    realizedSells?: number;
    solPriceUsed?: number;
    note?: string;
  };
};

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function pct(n: number) {
  const sign = n < 0 ? "" : "+";
  return `${sign}${n.toFixed(2)}%`;
}

// Simple Solana address check (base58-ish + length)
function isLikelySolanaAddress(s: string) {
  const a = s.trim();
  if (a.length < 32 || a.length > 44) return false;
  // base58 characters only (no 0,O,I,l)
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(a);
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-full text-xs font-semibold",
        "border transition",
        active
          ? "bg-green-400/15 border-green-400/30 text-green-200"
          : "bg-white/5 border-white/10 text-white/70 hover:border-white/20",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "orange";
  sub?: string;
}) {
  const toneClass =
    tone === "green"
      ? "text-green-300"
      : tone === "red"
      ? "text-red-300"
      : tone === "amber"
      ? "text-amber-300"
      : tone === "orange"
      ? "text-orange-300"
      : "text-white";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] font-semibold text-white/55">{label}</div>
      <div className={["mt-1 text-xl font-extrabold tracking-tight", toneClass].join(" ")}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-white/45">{sub}</div>}
    </div>
  );
}

function RowTrade({ t }: { t: Trade }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-extrabold">{t.symbol}</div>
          <div className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-black/30 text-white/60">
            {t.side}
          </div>
          <div className="text-[11px] text-white/45">{Math.round(t.timeInHours)}h</div>
        </div>
        <div className="text-xs text-white/55">Size {money(t.usd)}</div>
      </div>

      <div className="text-right">
        <div className={["text-sm font-extrabold", t.pnlUsd >= 0 ? "text-green-300" : "text-red-300"].join(" ")}>
          {money(t.pnlUsd)}
        </div>
        <div className={["text-xs", t.pnlPct >= 0 ? "text-green-200/70" : "text-red-200/70"].join(" ")}>
          {pct(t.pnlPct)}
        </div>
      </div>
    </div>
  );
}

const RECENT_KEY = "jp_wallet_review_recent";

export default function WalletReviewPage() {
  const [address, setAddress] = useState("");
  const [range, setRange] = useState<"7D" | "30D" | "90D" | "ALL">("30D");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [tipIndex, setTipIndex] = useState(0);
  const [showMeta, setShowMeta] = useState(false);
  const [openFull, setOpenFull] = useState(false);

  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecent(parsed.slice(0, 6).map(String));
      }
    } catch {}
  }, []);

  function saveRecent(addr: string) {
    const a = addr.trim();
    if (!a) return;
    const next = [a, ...recent.filter((x) => x !== a)].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  }

  const currentTip = useMemo(() => {
    if (!data?.tips?.length) return null;
    return data.tips[tipIndex % data.tips.length];
  }, [data, tipIndex]);

  const isValid = useMemo(() => isLikelySolanaAddress(address), [address]);

  async function analyze() {
    setErr(null);

    const a = address.trim();
    if (!a) return setErr("Paste a wallet address first.");
    if (!isLikelySolanaAddress(a)) return setErr("That doesn’t look like a valid Solana address.");

    setLoading(true);
    try {
      const res = await fetch(
        `/api/wallet-review?address=${encodeURIComponent(a)}&range=${range}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to analyze wallet");

      setData(json);
      setTipIndex(0);
      setShowMeta(false);
      setOpenFull(false);
      saveRecent(a);

      // auto-scroll down to results so page doesn’t feel empty
      setTimeout(() => {
        const el = document.getElementById("wallet-review-results");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setAddress("");
    setErr(null);
    setData(null);
    setTipIndex(0);
    setShowMeta(false);
    setOpenFull(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") analyze();
  }

  const priced = data?.meta?.pricedSwaps ?? 0;
  const unpriced = data?.meta?.unpricedSwaps ?? 0;
  const hasAnySwaps = (data?.meta?.swapsDetected ?? 0) > 0;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-14">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Wallet Review <span className="text-green-300">⚡</span>
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Paste a wallet address to surface best trades, worst trades, and “missed money” patterns.
          </p>
        </div>

        <Link href="/wallets" className="text-sm text-white/70 hover:text-white transition">
          Wallet Leaderboard →
        </Link>
      </div>

      {/* FORM */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-white/60">Wallet address</div>

              {address.trim().length > 0 && (
                <div className={["text-xs", isValid ? "text-green-300" : "text-amber-300"].join(" ")}>
                  {isValid ? "Valid address" : "Check address"}
                </div>
              )}
            </div>

            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Paste Solana wallet address"
              className={[
                "w-full rounded-xl border bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition",
                err ? "border-red-400/40 focus:border-red-400/60" : "border-white/10 focus:border-white/20",
              ].join(" ")}
            />

            {/* Recent chips */}
            {recent.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="text-xs text-white/45 mr-1">Recent:</div>
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setAddress(r)}
                    className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition"
                    title={r}
                  >
                    {r.slice(0, 6)}…{r.slice(-4)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Pill active={range === "7D"} onClick={() => setRange("7D")}>7D</Pill>
            <Pill active={range === "30D"} onClick={() => setRange("30D")}>30D</Pill>
            <Pill active={range === "90D"} onClick={() => setRange("90D")}>90D</Pill>
            <Pill active={range === "ALL"} onClick={() => setRange("ALL")}>ALL</Pill>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              type="button"
              className="px-4 py-3 rounded-xl font-semibold text-sm border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition"
            >
              Clear
            </button>

            <button
              onClick={analyze}
              disabled={loading || !isValid}
              className={[
                "px-4 py-3 rounded-xl font-semibold text-sm",
                "border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {loading ? "Analyzing…" : "Analyze →"}
            </button>
          </div>
        </div>

        {err && <div className="mt-3 text-sm text-red-300">{err}</div>}

        {!err && address.trim() && !isValid && (
          <div className="mt-3 text-xs text-amber-200/80">
            Solana addresses are base58 (no 0/O/I/l) and usually 32–44 chars.
          </div>
        )}
      </div>

      {/* RESULTS INLINE (fixes “empty page” feeling) */}
      <div id="wallet-review-results" className="mt-6">
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-pulse">
            <div className="h-4 w-44 bg-white/10 rounded" />
            <div className="mt-3 h-3 w-80 bg-white/10 rounded" />
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl bg-white/[0.04] border border-white/10" />
              ))}
            </div>
          </div>
        )}

        {!loading && data && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs text-white/50">Wallet Review • {data.summary.range}</div>
                <div className="mt-1 text-lg font-extrabold tracking-tight truncate">
                  {data.summary.address}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/60">
                    Swaps: {data.meta?.swapsDetected ?? 0}
                  </span>
                  <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/60">
                    Priced: {priced}
                  </span>
                  <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/60">
                    Unpriced: {unpriced}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTipIndex((i) => i + 1)}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/80"
                >
                  Next tip →
                </button>

                <button
                  onClick={() => setOpenFull(true)}
                  className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/80"
                >
                  Open full report →
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-6 gap-3">
              <StatCard
                label="Realized PnL"
                value={money(data.summary.realizedPnl)}
                tone={data.summary.realizedPnl >= 0 ? "green" : "red"}
                sub="FIFO on sells"
              />
              <StatCard label="Win Rate" value={`${data.summary.winRate}%`} sub="Realized sells" />
              <StatCard label="Trades" value={String(data.summary.trades)} sub="Priced swaps only" />
              <StatCard label="Avg Hold" value={`${data.summary.avgHoldHours}h`} sub="Oldest lot" />
              <StatCard label="Sold Early" value={money(data.summary.missedUpsideTotal)} tone="amber" sub="Phase 2" />
              <StatCard label="Bought Late" value={money(data.summary.ateDrawdownTotal)} tone="orange" sub="Phase 2" />
            </div>

            {/* Honest warning */}
            {hasAnySwaps && priced === 0 && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <div className="text-sm font-extrabold text-amber-200">
                  We detected swaps, but couldn’t price them
                </div>
                <div className="mt-1 text-sm text-amber-100/80">
                  This usually happens when swaps don’t involve USDC/USDT or SOL legs (so USD value is missing).
                  Try <span className="font-semibold">ALL</span>, or test a wallet that swaps vs SOL/USDC.
                </div>
                {data.meta?.solPriceUsed ? (
                  <div className="mt-2 text-xs text-amber-100/70">
                    SOL price used: ${Number(data.meta.solPriceUsed).toFixed(2)}
                  </div>
                ) : null}
              </div>
            )}

            {/* Trades */}
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                <div className="text-sm font-extrabold">Top Trades</div>
                <div className="text-xs text-white/55">Best realized PnL</div>
                <div className="mt-4 grid gap-2">
                  {data.topTrades.length ? (
                    data.topTrades.map((t) => <RowTrade key={t.id} t={t} />)
                  ) : (
                    <div className="text-sm text-white/55">No realized sells to rank yet.</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                <div className="text-sm font-extrabold">Worst Trades</div>
                <div className="text-xs text-white/55">Biggest realized losses</div>
                <div className="mt-4 grid gap-2">
                  {data.worstTrades.length ? (
                    data.worstTrades.map((t) => <RowTrade key={t.id} t={t} />)
                  ) : (
                    <div className="text-sm text-white/55">No realized sells to rank yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Suggestions */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-semibold text-white/55">Suggestions</div>
              <div className="mt-1 text-sm text-white/85">{currentTip || "No tips yet."}</div>
              {data.meta?.note && <div className="mt-2 text-xs text-white/45">{data.meta.note}</div>}
            </div>

            {/* Debug meta toggle */}
            <div className="mt-4">
              <button
                onClick={() => setShowMeta((s) => !s)}
                className="text-xs text-white/60 hover:text-white transition"
              >
                {showMeta ? "Hide debug" : "Show debug"} →
              </button>
              {showMeta && (
                <pre className="mt-3 text-xs text-white/60 rounded-2xl border border-white/10 bg-white/[0.03] p-4 overflow-auto">
                  {JSON.stringify(data.meta || {}, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FULL REPORT OVERLAY (optional) */}
      {openFull && data && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpenFull(false)} />

          <div className="absolute inset-0 flex items-center justify-center p-4 md:p-8">
            <div className="relative w-full max-w-6xl h-[92vh] rounded-3xl border border-white/10 bg-[#07090d] shadow-[0_30px_120px_rgba(0,0,0,0.85)] overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 md:px-7 py-4 border-b border-white/10">
                <div className="min-w-0">
                  <div className="text-xs text-white/50">Wallet Review • {data.summary.range}</div>
                  <div className="text-lg font-extrabold tracking-tight truncate">{data.summary.address}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTipIndex((i) => i + 1)}
                    className="hidden md:inline-flex px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/80"
                  >
                    Next tip →
                  </button>
                  <button
                    onClick={() => setOpenFull(false)}
                    className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm"
                  >
                    Close ✕
                  </button>
                </div>
              </div>

              <div className="h-full overflow-y-auto pb-24">
                <div className="px-5 md:px-7 pt-5 md:pt-7">
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    <StatCard
                      label="Realized PnL"
                      value={money(data.summary.realizedPnl)}
                      tone={data.summary.realizedPnl >= 0 ? "green" : "red"}
                      sub="FIFO on sells"
                    />
                    <StatCard label="Win Rate" value={`${data.summary.winRate}%`} sub="Realized sells" />
                    <StatCard label="Trades" value={String(data.summary.trades)} sub="Priced swaps only" />
                    <StatCard label="Avg Hold" value={`${data.summary.avgHoldHours}h`} sub="Oldest lot" />
                    <StatCard label="Sold Early" value={money(data.summary.missedUpsideTotal)} tone="amber" sub="Phase 2" />
                    <StatCard label="Bought Late" value={money(data.summary.ateDrawdownTotal)} tone="orange" sub="Phase 2" />
                  </div>

                  <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                      <div className="text-sm font-extrabold">Top Trades</div>
                      <div className="text-xs text-white/55">Best realized PnL</div>
                      <div className="mt-4 grid gap-2">
                        {data.topTrades.length ? (
                          data.topTrades.map((t) => <RowTrade key={t.id} t={t} />)
                        ) : (
                          <div className="text-sm text-white/55">No realized sells to rank yet.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                      <div className="text-sm font-extrabold">Worst Trades</div>
                      <div className="text-xs text-white/55">Biggest realized losses</div>
                      <div className="mt-4 grid gap-2">
                        {data.worstTrades.length ? (
                          data.worstTrades.map((t) => <RowTrade key={t.id} t={t} />)
                        ) : (
                          <div className="text-sm text-white/55">No realized sells to rank yet.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() => setShowMeta((s) => !s)}
                      className="text-xs text-white/60 hover:text-white transition"
                    >
                      {showMeta ? "Hide debug" : "Show debug"} →
                    </button>
                    {showMeta && (
                      <pre className="mt-3 text-xs text-white/60 rounded-2xl border border-white/10 bg-white/[0.03] p-4 overflow-auto">
                        {JSON.stringify(data.meta || {}, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              <div className="absolute left-0 right-0 bottom-0 border-t border-white/10 bg-black/40 backdrop-blur px-5 md:px-7 py-4">
                <div className="flex items-start md:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white/55">Suggestions</div>
                    <div className="mt-1 text-sm text-white/85">{currentTip || "No tips yet."}</div>
                    {data.meta?.note && <div className="mt-2 text-xs text-white/45">{data.meta.note}</div>}
                  </div>

                  <button
                    onClick={() => setTipIndex((i) => i + 1)}
                    className="shrink-0 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/80"
                  >
                    Next tip →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 text-xs text-white/40">
        Tip: “Missed money” needs candle data (Phase 2).
      </div>
    </div>
  );
}
