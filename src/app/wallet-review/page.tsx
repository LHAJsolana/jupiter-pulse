// FILE: src/app/wallet-review/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Trade = {
  id: string;
  ts: number;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  usd: number;
  pnlUsd: number;
  pnlPct: number;
  timeInHours: number;
  missedUpsideUsd: number;
  ateDrawdownUsd: number;
  realized?: boolean;
  matchedQty?: number;
  costBasisCoveragePct?: number;
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
    avgTradeUsd: number;
    largestTradeUsd: number;
    tradesPerDay: number;
    missedUpsideTotal: number;
    ateDrawdownTotal: number;
    biggestWin: Trade | null;
    biggestLoss: Trade | null;
  };
  profile: {
    label: string;
    score: number;
    confidence: "Low" | "Medium" | "High";
    tone: "green" | "amber" | "red" | "neutral";
    summary: string;
    strengths: string[];
    risks: string[];
  };
  dataQuality: {
    score: number;
    level: "Low" | "Medium" | "High";
    pricedSwapPct: number;
    unpricedSwapPct: number;
    summary: string;
    checks: Array<{ label: string; value: string; ok: boolean }>;
  };
  explainability: {
    verdict: string;
    methodology: string[];
    limitations: string[];
    metrics: Array<{
      key: string;
      label: string;
      confidence: "Low" | "Medium" | "High";
      evidenceCount: number;
      explanation: string;
    }>;
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

    spotSampleOk?: boolean;
    spotSamples?: number;
    spotSampleNote?: string;

    sampleTxKeys?: string[];
    sampleHasEventsSwap?: boolean;
    sampleType?: string | null;
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

function isLikelySolanaAddress(s: string) {
  const a = s.trim();
  if (a.length < 32 || a.length > 44) return false;
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

function TraderProfileCard({ profile }: { profile: ReviewResponse["profile"] }) {
  const toneClass =
    profile.tone === "green"
      ? "border-green-400/25 bg-green-400/[0.06]"
      : profile.tone === "red"
      ? "border-red-400/25 bg-red-400/[0.06]"
      : profile.tone === "amber"
      ? "border-amber-400/25 bg-amber-400/[0.06]"
      : "border-white/10 bg-white/[0.03]";

  const scoreClass =
    profile.tone === "green"
      ? "text-green-300"
      : profile.tone === "red"
      ? "text-red-300"
      : profile.tone === "amber"
      ? "text-amber-300"
      : "text-white";

  const scoreWidth = `${Math.max(0, Math.min(100, profile.score))}%`;

  return (
    <div className={["rounded-2xl border p-4 md:p-5", toneClass].join(" ")}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white/55">Trader Profile</div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <div className="text-2xl font-extrabold tracking-tight">{profile.label}</div>
            <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-black/25 text-white/65">
              {profile.confidence} confidence
            </span>
          </div>
          <p className="mt-2 text-sm text-white/70 max-w-3xl">{profile.summary}</p>
        </div>

        <div className="shrink-0 text-right">
          <div className={["text-4xl font-extrabold", scoreClass].join(" ")}>{profile.score}</div>
          <div className="text-xs text-white/45">behavior score</div>
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-current text-white/70" style={{ width: scoreWidth }} />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-white/55">Strengths</div>
          <div className="mt-2 grid gap-1.5">
            {profile.strengths.length ? (
              profile.strengths.map((x) => (
                <div key={x} className="text-sm text-white/75">
                  + {x}
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">Not enough positive patterns yet.</div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-white/55">Risks</div>
          <div className="mt-2 grid gap-1.5">
            {profile.risks.length ? (
              profile.risks.map((x) => (
                <div key={x} className="text-sm text-white/75">
                  - {x}
                </div>
              ))
            ) : (
              <div className="text-sm text-white/45">No major behavior risks detected.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildShareText(data: ReviewResponse) {
  const best = data.summary.biggestWin
    ? `${data.summary.biggestWin.symbol} ${money(data.summary.biggestWin.pnlUsd)}`
    : "No ranked win yet";
  const worst = data.summary.biggestLoss
    ? `${data.summary.biggestLoss.symbol} ${money(data.summary.biggestLoss.pnlUsd)}`
    : "No ranked loss yet";
  const topRisk = data.profile.risks[0] || "No major risk flagged";

  return [
    "Jupiter Pulse Wallet Report",
    `${data.summary.address} | ${data.summary.range}`,
    `Profile: ${data.profile.label} (${data.profile.score}/100, ${data.profile.confidence} confidence)`,
    `PnL: ${money(data.summary.realizedPnl)} | Win rate: ${data.summary.winRate}% | Trades: ${data.summary.trades}`,
    `Best: ${best}`,
    `Worst: ${worst}`,
    `Main note: ${topRisk}`,
  ].join("\n");
}

function ShareableReportCard({
  data,
  copied,
  onCopy,
}: {
  data: ReviewResponse;
  copied: boolean;
  onCopy: () => void;
}) {
  const shareText = buildShareText(data);
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-semibold text-white/55">Shareable Report</div>
          <div className="mt-1 text-xl font-extrabold">Wallet Report Card</div>
          <div className="mt-1 text-sm text-white/55">
            Clean summary for sharing the wallet behavior snapshot.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm text-white/80"
          >
            {copied ? "Copied" : "Copy summary"}
          </button>
          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl border border-green-400/20 bg-green-400/10 hover:bg-green-400/15 transition text-sm text-green-100"
          >
            Share on X
          </a>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-white/45">Jupiter Pulse</div>
            <div className="mt-1 text-2xl font-extrabold">{data.profile.label}</div>
            <div className="mt-1 text-sm text-white/60">{data.summary.address}</div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-extrabold text-green-300">{data.profile.score}</div>
            <div className="text-xs text-white/45">score</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Realized PnL" value={money(data.summary.realizedPnl)} tone={data.summary.realizedPnl >= 0 ? "green" : "red"} />
          <StatCard label="Win Rate" value={`${data.summary.winRate}%`} />
          <StatCard label="Avg Hold" value={`${data.summary.avgHoldHours}h`} />
          <StatCard label="Quality" value={`${data.dataQuality.score}/100`} tone={data.dataQuality.level === "High" ? "green" : data.dataQuality.level === "Low" ? "red" : "amber"} />
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-xs font-semibold text-white/45">Top mistake</div>
            <div className="mt-1 text-sm text-white/80">{data.profile.risks[0] || "No major risk flagged."}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-xs font-semibold text-white/45">Best behavior</div>
            <div className="mt-1 text-sm text-white/80">{data.profile.strengths[0] || "Not enough positive patterns yet."}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataQualityPanel({ dataQuality }: { dataQuality: ReviewResponse["dataQuality"] }) {
  const tone =
    dataQuality.level === "High"
      ? "border-green-400/25 bg-green-400/[0.06]"
      : dataQuality.level === "Low"
      ? "border-red-400/25 bg-red-400/[0.06]"
      : "border-amber-400/25 bg-amber-400/[0.06]";

  return (
    <div className={["rounded-2xl border p-4 md:p-5", tone].join(" ")}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-semibold text-white/55">Data Quality</div>
          <div className="mt-1 text-xl font-extrabold">{dataQuality.level} confidence layer</div>
          <p className="mt-1 text-sm text-white/65">{dataQuality.summary}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold">{dataQuality.score}/100</div>
          <div className="text-xs text-white/45">
            {dataQuality.pricedSwapPct}% priced / {dataQuality.unpricedSwapPct}% unpriced
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-2">
        {dataQuality.checks.map((check) => (
          <div key={check.label} className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-[11px] text-white/45">{check.label}</div>
            <div className={["mt-1 text-sm font-bold", check.ok ? "text-white" : "text-amber-200"].join(" ")}>
              {check.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExplainabilityPanel({
  explainability,
}: {
  explainability: ReviewResponse["explainability"];
}) {
  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.05] p-4 md:p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-sky-200/65">
        Why this report says what it says
      </div>
      <p className="mt-2 text-sm font-semibold text-white/85">{explainability.verdict}</p>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {explainability.metrics.map((metric) => (
          <div key={metric.key} className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold">{metric.label}</div>
              <span
                className={[
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  metric.confidence === "High"
                    ? "border-green-400/25 bg-green-400/10 text-green-200"
                    : metric.confidence === "Medium"
                      ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
                      : "border-white/15 bg-white/5 text-white/55",
                ].join(" ")}
              >
                {metric.confidence} confidence
              </span>
            </div>
            <div className="mt-1 text-xs text-white/55">{metric.explanation}</div>
            <div className="mt-2 text-[11px] text-white/40">
              Evidence: {metric.evidenceCount} relevant event{metric.evidenceCount === 1 ? "" : "s"}
            </div>
          </div>
        ))}
      </div>

      <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-white/75">
          Method and limitations
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-bold text-white/55">Method</div>
            <ul className="mt-2 space-y-1.5 text-xs text-white/60">
              {explainability.methodology.map((item) => <li key={item}>+ {item}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold text-white/55">Limitations</div>
            <ul className="mt-2 space-y-1.5 text-xs text-white/60">
              {explainability.limitations.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}

function RowTrade({
  t,
  extraLabel,
  extraValue,
  extraTone,
}: {
  t: Trade;
  extraLabel?: string;
  extraValue?: string;
  extraTone?: "amber" | "orange";
}) {
  const extraClass =
    extraTone === "amber"
      ? "text-amber-200/80"
      : extraTone === "orange"
      ? "text-orange-200/80"
      : "text-white/55";

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
        <div className="text-xs text-white/55">
          Size {money(t.usd)}
          {extraLabel && extraValue ? (
            <>
              <span className="mx-2 text-white/25">•</span>
              <span className={["text-xs", extraClass].join(" ")}>
                {extraLabel} {extraValue}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="text-right">
        <div className={["text-sm font-extrabold", t.pnlUsd >= 0 ? "text-green-300" : "text-red-300"].join(" ")}>
          {money(t.pnlUsd)}
        </div>
        <div className={["text-xs", t.pnlPct >= 0 ? "text-green-200/70" : "text-red-200/70"].join(" ")}>
          {pct(t.pnlPct)}
        </div>
        {t.side === "SELL" && typeof t.costBasisCoveragePct === "number" && (
          <div className="mt-1 text-[10px] text-white/40">
            {Math.round(t.costBasisCoveragePct)}% cost basis matched
          </div>
        )}
        {t.id && (
          <a
            href={`https://solscan.io/tx/${encodeURIComponent(t.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[10px] text-sky-300/70 hover:text-sky-200"
          >
            View transaction &rarr;
          </a>
        )}
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
  const [copiedReport, setCopiedReport] = useState(false);

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

  const isValid = useMemo(() => isLikelySolanaAddress(address), [address]);

  const currentTip = useMemo(() => {
    if (!data?.tips?.length) return null;
    return data.tips[tipIndex % data.tips.length];
  }, [data, tipIndex]);

  async function analyze() {
    setErr(null);

    const a = address.trim();
    if (!a) return setErr("Paste a wallet address first.");
    if (!isLikelySolanaAddress(a)) return setErr("That doesn’t look like a valid Solana address.");

    setLoading(true);
    try {
      const res = await fetch(`/api/wallet-review?address=${encodeURIComponent(a)}&range=${range}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to analyze wallet");

      setData(json);
      setTipIndex(0);
      setShowMeta(false);
      setOpenFull(false);
      setCopiedReport(false);
      saveRecent(a);

      setTimeout(() => {
        const el = document.getElementById("wallet-review-results");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
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
    setCopiedReport(false);
  }

  async function copyReport() {
    if (!data) return;
    const text = buildShareText(data);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 1800);
    } catch {
      setErr("Could not copy report to clipboard.");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") analyze();
  }

  const priced = data?.meta?.pricedSwaps ?? 0;
  const unpriced = data?.meta?.unpricedSwaps ?? 0;
  const hasAnySwaps = (data?.meta?.swapsDetected ?? 0) > 0;

  // ✅ Only say “missed money heuristic” if we have enough priced data or actual missed events.
  const hasMissedEvents =
    !!data && ((data.missed?.soldEarlyTotal ?? 0) > 0 || (data.missed?.boughtLateTotal ?? 0) > 0);

  const canComputeMissedMoney = priced > 0 && hasAnySwaps; // minimal truthy condition

  // Optional: show “likely” reason (not absolute).
  const likelyTokenToTokenNoBase = hasAnySwaps && priced === 0;

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
                <div className="mt-1 text-lg font-extrabold tracking-tight truncate">{data.summary.address}</div>

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
                  {data.meta?.spotSampleOk ? (
                    <span className="text-[11px] px-2 py-1 rounded-full border border-green-400/20 bg-green-400/10 text-green-200/80">
                      Jupiter spot OK
                    </span>
                  ) : null}
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

            <div className="mt-5">
              <TraderProfileCard profile={data.profile} />
            </div>

            <div className="mt-5">
              <ExplainabilityPanel explainability={data.explainability} />
            </div>

            <div className="mt-5">
              <ShareableReportCard data={data} copied={copiedReport} onCopy={copyReport} />
            </div>

            <div className="mt-5">
              <DataQualityPanel dataQuality={data.dataQuality} />
            </div>

            {/* ✅ Honest warning, no absolute claims */}
            {hasAnySwaps && priced === 0 && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <div className="text-sm font-extrabold text-amber-200">
                  We detected swaps, but couldn’t price them
                </div>
                <div className="mt-1 text-sm text-amber-100/80">
                  This often happens when swaps don’t include a clear USD leg (SOL/USDC/USDT), so USD value can’t be inferred.
                  Try <span className="font-semibold">ALL</span>, or test a wallet that swaps vs SOL/USDC.
                </div>
                {likelyTokenToTokenNoBase ? (
                  <div className="mt-2 text-xs text-amber-100/70">
                    Likely cause: token→token routes without SOL/USDC/USDT legs (not guaranteed).
                  </div>
                ) : null}
                {data.meta?.solPriceUsed ? (
                  <div className="mt-2 text-xs text-amber-100/70">
                    SOL price used: ${Number(data.meta.solPriceUsed).toFixed(2)}
                  </div>
                ) : null}
              </div>
            )}

            {/* ✅ Missed Money: truthful gating */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-extrabold">Missed Money</div>
                  <div className="text-xs text-white/55">
                    {canComputeMissedMoney
                      ? "Heuristic from your priced swaps (candles-grade attribution comes next)."
                      : "Can’t compute yet — needs priced swaps (SOL/USDC/USDT legs) or candles attribution."}
                  </div>
                </div>
                <Link href="/missed-money" className="text-xs text-white/60 hover:text-white transition">
                  Open Missed Money module →
                </Link>
              </div>

              {!canComputeMissedMoney ? (
                <div className="mt-4 text-sm text-white/60">
                  No missed-money calculation available for this wallet in the current range.
                </div>
              ) : !hasMissedEvents ? (
                <div className="mt-4 text-sm text-white/60">
                  Nothing meaningful detected yet (needs enough priced swaps and follow-through).
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold">Sold Early</div>
                      <div className="text-sm font-extrabold text-amber-200">{money(data.missed.soldEarlyTotal)}</div>
                    </div>
                    <div className="mt-1 text-xs text-white/55">Best price later within lookahead window.</div>
                    <div className="mt-3 grid gap-2">
                      {data.missed.earlySells?.length ? (
                        data.missed.earlySells.slice(0, 4).map((t) => (
                          <RowTrade
                            key={t.id}
                            t={t}
                            extraLabel="Missed"
                            extraValue={money(t.missedUpsideUsd)}
                            extraTone="amber"
                          />
                        ))
                      ) : (
                        <div className="text-sm text-white/55">No clear early sells.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold">Bought Late</div>
                      <div className="text-sm font-extrabold text-orange-200">{money(data.missed.boughtLateTotal)}</div>
                    </div>
                    <div className="mt-1 text-xs text-white/55">Worst dip later within lookahead window.</div>
                    <div className="mt-3 grid gap-2">
                      {data.missed.lateBuys?.length ? (
                        data.missed.lateBuys.slice(0, 4).map((t) => (
                          <RowTrade
                            key={t.id}
                            t={t}
                            extraLabel="Ate"
                            extraValue={money(t.ateDrawdownUsd)}
                            extraTone="orange"
                          />
                        ))
                      ) : (
                        <div className="text-sm text-white/55">No clear late buys.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-semibold text-white/55">Suggestions</div>
              <div className="mt-1 text-sm text-white/85">{currentTip || "No tips yet."}</div>
              {data.meta?.note && <div className="mt-2 text-xs text-white/45">{data.meta.note}</div>}
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
        )}
      </div>

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
                  {/* keep as-is; main fix was truthful Missed Money copy in inline section */}
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

                  <div className="mt-5">
                    <TraderProfileCard profile={data.profile} />
                  </div>

                  <div className="mt-5">
                    <ExplainabilityPanel explainability={data.explainability} />
                  </div>

                  <div className="mt-5">
                    <ShareableReportCard data={data} copied={copiedReport} onCopy={copyReport} />
                  </div>

                  <div className="mt-5">
                    <DataQualityPanel dataQuality={data.dataQuality} />
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
        Tip: Missed money is Phase 2. If the wallet has 0 priced swaps, we won’t compute it yet.
      </div>
    </div>
  );
}
