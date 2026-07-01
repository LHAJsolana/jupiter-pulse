"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Review = {
  address: string;
  summary: {
    address: string;
    range: string;
    realizedPnl: number;
    winRate: number;
    trades: number;
    avgHoldHours: number;
    missedUpsideTotal: number;
    ateDrawdownTotal: number;
    tradesPerDay?: number;
  };
  profile: {
    label: string;
    score: number;
    confidence: "Low" | "Medium" | "High";
  };
  dataQuality?: {
    score: number;
    level: "Low" | "Medium" | "High";
  };
};

function money(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function shortAddress(a: string) {
  return a.length > 14 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

function winnerLabel(a: number, b: number, highIsGood = true) {
  if (a === b) return "Tie";
  const aWins = highIsGood ? a > b : a < b;
  return aWins ? "Wallet A" : "Wallet B";
}

export default function WalletComparePage() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [range, setRange] = useState<"7D" | "30D" | "90D" | "ALL">("30D");
  const [left, setLeft] = useState<Review | null>(null);
  const [right, setRight] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchReview(address: string) {
    const res = await fetch(`/api/wallet-review?address=${encodeURIComponent(address)}&range=${range}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed to analyze wallet");
    return json as Review;
  }

  async function compare() {
    const aa = a.trim();
    const bb = b.trim();
    if (!aa || !bb) {
      setError("Paste two wallet addresses first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [ra, rb] = await Promise.all([fetchReview(aa), fetchReview(bb)]);
      setLeft(ra);
      setRight(rb);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Comparison failed");
      setLeft(null);
      setRight(null);
    } finally {
      setLoading(false);
    }
  }

  const verdicts = useMemo(() => {
    if (!left || !right) return [];
    return [
      {
        label: "Better realized PnL",
        winner: winnerLabel(left.summary.realizedPnl, right.summary.realizedPnl),
        left: money(left.summary.realizedPnl),
        right: money(right.summary.realizedPnl),
      },
      {
        label: "Cleaner exits",
        winner: winnerLabel(
          left.summary.missedUpsideTotal,
          right.summary.missedUpsideTotal,
          false
        ),
        left: money(left.summary.missedUpsideTotal),
        right: money(right.summary.missedUpsideTotal),
      },
      {
        label: "Less overtrading",
        winner: winnerLabel(left.summary.tradesPerDay ?? 0, right.summary.tradesPerDay ?? 0, false),
        left: `${(left.summary.tradesPerDay ?? 0).toFixed(2)}/day`,
        right: `${(right.summary.tradesPerDay ?? 0).toFixed(2)}/day`,
      },
      {
        label: "Holds winners longer",
        winner: winnerLabel(left.summary.avgHoldHours, right.summary.avgHoldHours),
        left: `${left.summary.avgHoldHours}h`,
        right: `${right.summary.avgHoldHours}h`,
      },
    ];
  }, [left, right]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-white/45">
            <Link href="/" className="hover:text-white">Home</Link> / Wallet Compare
          </div>
          <h1 className="mt-3 text-4xl font-extrabold">Wallet Compare</h1>
          <p className="mt-2 text-sm text-white/55 max-w-2xl">
            Compare two wallets across realized PnL, exit quality, trading frequency, and hold behavior.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto] gap-3">
          <input
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="Wallet A address"
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-white/25"
          />
          <input
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder="Wallet B address"
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-white/25"
          />
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as typeof range)}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-white/25"
          >
            <option value="7D">7D</option>
            <option value="30D">30D</option>
            <option value="90D">90D</option>
            <option value="ALL">ALL</option>
          </select>
          <button
            type="button"
            onClick={compare}
            disabled={loading}
            className="px-4 py-3 rounded-xl border border-green-400/30 bg-green-400/10 hover:bg-green-400/15 disabled:opacity-50 text-sm font-semibold text-green-100"
          >
            {loading ? "Comparing..." : "Compare"}
          </button>
        </div>
        {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
      </div>

      {left && right && (
        <div className="mt-8 grid gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WalletCard title="Wallet A" data={left} />
            <WalletCard title="Wallet B" data={right} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-extrabold">Head-to-head</h2>
            <div className="mt-4 grid gap-3">
              {verdicts.map((v) => (
                <div key={v.label} className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold">{v.label}</div>
                      <div className="mt-1 text-sm text-white/50">
                        A: {v.left} / B: {v.right}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-green-300">{v.winner}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WalletCard({ title, data }: { title: string; data: Review }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-white/45">{title}</div>
          <div className="mt-1 text-lg font-extrabold">{shortAddress(data.address)}</div>
          <div className="mt-1 text-sm text-white/55">{data.profile.label}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold text-green-300">{data.profile.score}</div>
          <div className="text-xs text-white/45">{data.profile.confidence}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniStat label="PnL" value={money(data.summary.realizedPnl)} />
        <MiniStat label="Win Rate" value={`${data.summary.winRate}%`} />
        <MiniStat label="Trades" value={String(data.summary.trades)} />
        <MiniStat label="Avg Hold" value={`${data.summary.avgHoldHours}h`} />
        <MiniStat label="Sold Early" value={money(data.summary.missedUpsideTotal)} />
        <MiniStat label="Quality" value={`${data.dataQuality?.score ?? 0}/100`} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="text-[11px] text-white/45">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}
