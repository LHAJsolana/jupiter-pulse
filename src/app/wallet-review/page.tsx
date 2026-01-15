// src/app/wallet-review/page.tsx
"use client";

import { useMemo, useState } from "react";
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
    swapsDetected?: number;
    realizedSells?: number;
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

function shortAddr(a: string) {
  if (!a) return "";
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
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

function RowTrade({
  t,
  mode,
}: {
  t: Trade;
  mode: "pnl" | "missed_up" | "missed_down";
}) {
  const main =
    mode === "pnl"
      ? t.pnlUsd
      : mode === "missed_up"
      ? t.missedUpsideUsd
      : t.ateDrawdownUsd;

  const mainLabel =
    mode === "pnl"
      ? money(main)
      : mode === "missed_up"
      ? `Missed ${money(main)}`
      : `Ate ${money(main)}`;

  const mainTone =
    mode === "pnl"
      ? t.pnlUsd >= 0
        ? "text-green-300"
        : "text-red-300"
      : mode === "missed_up"
      ? "text-amber-300"
      : "text-orange-300";

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
        <div className={["text-sm font-extrabold", mainTone].join(" ")}>
          {mainLabel}
        </div>
        {mode === "pnl" && (
          <div
            className={[
              "text-xs",
              t.pnlPct >= 0 ? "text-green-200/70" : "text-red-200/70",
            ].join(" ")}
          >
            {pct(t.pnlPct)}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyBox({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-extrabold">{title}</div>
      <div className="mt-1 text-sm text-white/55">{desc}</div>
    </div>
  );
}

export default function WalletReviewPage() {
  const [address, setAddress] = useState("");
  const [range, setRange] = useState<"7D" | "30D" | "90D" | "ALL">("30D");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  const currentTip = useMemo(() => {
    if (!data?.tips?.length) return null;
    return data.tips[tipIndex % data.tips.length];
  }, [data, tipIndex]);

  const hasRealized = useMemo(() => {
    const rs = data?.meta?.realizedSells ?? 0;
    return rs > 0 && (data?.topTrades?.length || data?.worstTrades?.length);
  }, [data]);

  async function analyze() {
    setErr(null);
    setLoading(true);

    try {
      const a = address.trim();
      if (!a) {
        setErr("Paste a wallet address first.");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/wallet-review?address=${encodeURIComponent(a)}&range=${range}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to analyze wallet");

      setData(json);
      setTipIndex(0);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 pb-14">
      {/* Header (CoinStats-ish) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Wallet Review <span className="text-green-300">⚡</span>
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Real on-chain wallet performance (FIFO realized PnL). Missed-money is Phase 2.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/60">
              Source: {data?.meta?.source || "—"}
            </span>
            <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/60">
              Swaps: {data?.meta?.swapsDetected ?? "—"}
            </span>
            <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/60">
              Realized sells: {data?.meta?.realizedSells ?? "—"}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Link href="/wallets" className="text-sm text-white/70 hover:text-white transition">
            Wallet Leaderboard →
          </Link>
          {data?.summary?.address && (
            <div className="text-xs text-white/50">
              Wallet: <span className="text-white/80 font-semibold">{data.summary.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Input bar (tight + pro) */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-white/60 mb-2">
              Wallet address
            </div>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Paste Solana wallet address"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20"
            />
          </div>

          <div className="flex items-center gap-2 md:mt-6">
            <Pill active={range === "7D"} onClick={() => setRange("7D")}>7D</Pill>
            <Pill active={range === "30D"} onClick={() => setRange("30D")}>30D</Pill>
            <Pill active={range === "90D"} onClick={() => setRange("90D")}>90D</Pill>
            <Pill active={range === "ALL"} onClick={() => setRange("ALL")}>ALL</Pill>
          </div>

          <button
            onClick={analyze}
            disabled={loading}
            className={[
              "md:mt-6 px-4 py-3 rounded-xl font-semibold text-sm",
              "border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {loading ? "Analyzing…" : "Analyze →"}
          </button>
        </div>

        {err && <div className="mt-3 text-sm text-red-300">{err}</div>}
      </div>

      {/* Dashboard */}
      <div className="mt-6">
        {!data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EmptyBox
              title="Paste a wallet to start"
              desc="We’ll pull swap activity from Helius enhanced transactions and compute FIFO realized PnL."
            />
            <EmptyBox
              title="How PnL works here"
              desc="PnL is only realized on SELL swaps. If a wallet only buys/holds, realized PnL will be $0."
            />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <StatCard
                label="Realized PnL"
                value={money(data.summary.realizedPnl)}
                tone={data.summary.realizedPnl >= 0 ? "green" : "red"}
                sub="FIFO on sells"
              />
              <StatCard
                label="Win Rate"
                value={`${data.summary.winRate}%`}
                sub="Realized sells only"
              />
              <StatCard
                label="Swaps Parsed"
                value={String(data.meta?.swapsDetected ?? 0)}
                sub="From enhanced txs"
              />
              <StatCard
                label="Avg Hold"
                value={`${data.summary.avgHoldHours}h`}
                sub="From oldest lot"
              />
              <StatCard
                label="Sold Early"
                value={money(data.summary.missedUpsideTotal)}
                tone="amber"
                sub="Phase 2"
              />
              <StatCard
                label="Bought Late"
                value={money(data.summary.ateDrawdownTotal)}
                tone="orange"
                sub="Phase 2"
              />
            </div>

            {/* Honest empty state */}
            {!hasRealized && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-extrabold">No realized sells detected</div>
                    <div className="mt-1 text-sm text-white/55">
                      This wallet hasn’t completed sell swaps in the selected range — realized PnL stays at $0.
                      Try <span className="text-white/80 font-semibold">ALL</span> or use a wallet that actively trades.
                    </div>
                  </div>
                  <div className="text-xs text-white/45">
                    Wallet: <span className="text-white/70">{shortAddr(data.address)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tables */}
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold">Top Trades</div>
                    <div className="text-xs text-white/55">Best realized PnL</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {data.topTrades.length ? (
                    data.topTrades.map((t) => <RowTrade key={t.id} t={t} mode="pnl" />)
                  ) : (
                    <div className="text-sm text-white/55">
                      No realized sell trades to rank yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold">Worst Trades</div>
                    <div className="text-xs text-white/55">Biggest realized losses</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {data.worstTrades.length ? (
                    data.worstTrades.map((t) => <RowTrade key={t.id} t={t} mode="pnl" />)
                  ) : (
                    <div className="text-sm text-white/55">
                      No realized sell trades to rank yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Phase 2 sections */}
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                <div className="text-sm font-extrabold">Sold Early (Missed Upside)</div>
                <div className="text-xs text-white/55">
                  Requires candle data (Phase 2) — showing 0 for now.
                </div>
                <div className="mt-4">
                  <div className="text-sm text-white/55">
                    Coming soon: “after you sold, price ran +X%” with exact max candle.
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
                <div className="text-sm font-extrabold">Bought Late (Ate Drawdown)</div>
                <div className="text-xs text-white/55">
                  Requires candle data (Phase 2) — showing 0 for now.
                </div>
                <div className="mt-4">
                  <div className="text-sm text-white/55">
                    Coming soon: “after you bought, price dipped -Y%” using post-entry drawdown.
                  </div>
                </div>
              </div>
            </div>

            {/* Tips bar (CoinStats-ish sticky card, not modal) */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 backdrop-blur p-4 md:p-5">
              <div className="flex items-start md:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white/55">Suggestions</div>
                  <div className="mt-1 text-sm text-white/85">
                    {currentTip || "No tips yet."}
                  </div>
                  {data.meta?.note && (
                    <div className="mt-2 text-[11px] text-white/45">{data.meta.note}</div>
                  )}
                </div>

                <button
                  onClick={() => setTipIndex((i) => i + 1)}
                  className="shrink-0 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/80"
                >
                  Next tip →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-10 text-xs text-white/40">
        Built by @lhajsol • Powered by Jupiter & Solana ⚡
      </div>
    </div>
  );
}
