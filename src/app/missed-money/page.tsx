"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fetchJSON, MissedMoneySummary } from "@/lib/api";

type MissedMoneyResponse = MissedMoneySummary & {
  meta?: {
    txFetched?: number;
    windowedTx?: number;
    swapsDetected?: number;
    pricedSwaps?: number;
    unpricedSwaps?: number;
    perpsTxCount?: number;
    note?: string;
  };
};

export default function MissedMoneyPage() {
  const [wallet, setWallet] = useState("");
  const [days, setDays] = useState<7 | 30>(30);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MissedMoneyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canFetch = useMemo(() => wallet.trim().length >= 32, [wallet]);

  async function run() {
    if (!canFetch) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetchJSON<MissedMoneyResponse>(
        `/api/missed-money?wallet=${encodeURIComponent(wallet.trim())}&days=${days}`
      );
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0b0f1a] to-black text-white">
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          Missed Money <span className="text-yellow-400">💸</span>
        </h1>

        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-300 hover:text-white transition">
            ← Home
          </Link>
          <Link href="/pulse" className="text-sm text-gray-300 hover:text-[#14F195] transition">
            Pulse →
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 pb-10">
        <section className="pt-6 pb-4">
          <h2 className="text-3xl md:text-4xl font-extrabold">Phase 2: Opportunity Scanner</h2>
          <p className="mt-2 text-gray-400 max-w-3xl">
            No Birdeye. No DexScreener. No GeckoTerminal.
            <br />
            We focus on{" "}
            <span className="text-white font-semibold">protocol-level value leaks</span>: routing,
            limit usage, <span className="text-white font-semibold">perps borrow fees</span>, and
            idle capital.
          </p>
        </section>

        {/* Controls */}
        <section className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="Enter Solana wallet address…"
              className="w-full md:flex-1 rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm outline-none focus:border-white/25"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDays(7)}
                className={[
                  "px-3 py-2 rounded-xl text-sm border transition",
                  days === 7
                    ? "border-[#14F195]/60 bg-[#14F195]/10 text-white"
                    : "border-white/10 bg-black/40 text-gray-300 hover:border-white/25",
                ].join(" ")}
              >
                7D
              </button>
              <button
                onClick={() => setDays(30)}
                className={[
                  "px-3 py-2 rounded-xl text-sm border transition",
                  days === 30
                    ? "border-[#14F195]/60 bg-[#14F195]/10 text-white"
                    : "border-white/10 bg-black/40 text-gray-300 hover:border-white/25",
                ].join(" ")}
              >
                30D
              </button>

              <button
                onClick={run}
                disabled={!canFetch || loading}
                className={[
                  "ml-1 px-4 py-2 rounded-xl text-sm font-semibold transition border",
                  !canFetch || loading
                    ? "border-white/10 bg-white/5 text-gray-500 cursor-not-allowed"
                    : "border-yellow-400/40 bg-yellow-400/10 hover:bg-yellow-400/15 text-white",
                ].join(" ")}
              >
                {loading ? "Scanning…" : "Scan"}
              </button>
            </div>
          </div>

          {error ? (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          ) : (
            <p className="mt-3 text-xs text-gray-500">
              Tip: best results when swaps include SOL/USDC/USDT legs (so USD value can be inferred).
            </p>
          )}

          {data?.meta && (
            <p className="mt-2 text-xs text-gray-500">
              Meta: tx={data.meta.txFetched ?? 0}
              {typeof data.meta.windowedTx === "number" ? ` • window=${data.meta.windowedTx}` : ""}
              {" • "}
              swaps={data.meta.swapsDetected ?? 0} • priced={data.meta.pricedSwaps ?? 0} • unpriced=
              {data.meta.unpricedSwaps ?? 0}
              {typeof data.meta.perpsTxCount === "number" ? ` • perpsTx=${data.meta.perpsTxCount}` : ""}
            </p>
          )}

          {data?.meta?.note && <p className="mt-2 text-xs text-gray-600">{data.meta.note}</p>}
        </section>

        {/* Summary */}
        {data && (
          <>
            <section className="pt-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                  title="Total Missed"
                  value={`$${fmtUsd(data.totalMissedUsd)}`}
                  hint={`${data.rangeDays} day window`}
                  accent="yellow"
                />

                {data.modules.map((m) => (
                  <StatCard
                    key={m.key}
                    title={m.title}
                    value={`$${fmtUsd(m.missedUsd)}`}
                    hint={m.note}
                    accent={m.key === "routing" ? "green" : "default"}
                  />
                ))}
              </div>
            </section>

            {/* Timeline */}
            <section className="pt-5">
              <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">Missed Events</h3>
                  <span className="text-xs text-gray-500">{data.events.length} events</span>
                </div>

                <div className="mt-3 space-y-3">
                  {data.events.map((ev, idx) => (
                    <div
                      key={`${ev.ts}-${idx}`}
                      className="rounded-xl border border-white/10 bg-black/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{ev.title}</p>
                          <p className="text-sm text-gray-400 mt-1">{ev.detail}</p>
                          <p className="text-xs text-gray-600 mt-2">
                            {new Date(ev.ts).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-yellow-300">-${fmtUsd(ev.missedUsd)}</p>
                          <p className="text-xs text-gray-500">{ev.type}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {data.events.length === 0 && (
                    <div className="rounded-xl border border-white/10 bg-black/50 p-3 text-sm text-gray-400">
                      No missed events detected yet in this window.
                    </div>
                  )}
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  Next modules: Limit fill-window logic → Perps borrow-fee math → Idle capital cost.
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  accent,
}: {
  title: string;
  value: string;
  hint: string;
  accent?: "green" | "yellow" | "default";
}) {
  const accentCls =
    accent === "green"
      ? "border-[#14F195]/50 bg-[#14F195]/5"
      : accent === "yellow"
        ? "border-yellow-400/50 bg-yellow-400/5"
        : "border-white/10 bg-black/40";

  return (
    <div
      className={[
        "rounded-2xl border backdrop-blur p-5",
        "shadow-[0_0_30px_rgba(255,255,255,0.04)]",
        accentCls,
      ].join(" ")}
    >
      <p className="text-xs uppercase tracking-widest text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
      <p className="mt-2 text-sm text-gray-400">{hint}</p>
    </div>
  );
}

function fmtUsd(n: number) {
  const x = Math.max(0, Number.isFinite(n) ? n : 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
