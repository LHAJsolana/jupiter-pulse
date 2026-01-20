"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function WalletPage() {
  const { address } = useParams() as { address: string };
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const r = await fetch(`/api/wallets/${address}`, { cache: "no-store" });
        const j = await r.json();

        if (!r.ok) {
          throw new Error(j?.error || `Request failed (${r.status})`);
        }

        if (alive) setData(j);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Failed to load wallet");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (address) run();
    return () => {
      alive = false;
    };
  }, [address]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-[#0b0f1a] to-black text-white">
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Wallet</h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-300 hover:text-white transition">
            ← Home
          </Link>
          <Link href="/pulse" className="text-sm text-gray-300 hover:text-[#14F195] transition">
            Pulse →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-16">
        {loading && (
          <div className="py-20 text-gray-400 animate-pulse">Loading…</div>
        )}

        {!loading && err && (
          <div className="py-10">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="font-bold text-red-200">Couldn’t load wallet</p>
              <p className="mt-2 text-sm text-red-200/80">{err}</p>
              <p className="mt-3 text-xs text-gray-400">
                Make sure <span className="text-white">HELIUS_API_KEY</span> is set in{" "}
                <span className="text-white">.env.local</span>.
              </p>
            </div>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="pt-6">
              <h2 className="text-2xl md:text-3xl font-extrabold break-all">
                {data.address}
              </h2>
              {data.meta?.note && (
                <p className="mt-2 text-sm text-gray-400">{data.meta.note}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
              <div className="p-5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-gray-500">
                  Volume (30D)
                </p>
                <p className="mt-2 text-2xl font-extrabold">
                  ${Number(data.stats.totalVolume || 0).toLocaleString()}
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-gray-500">
                  Win Rate
                </p>
                <p className="mt-2 text-2xl font-extrabold">
                  {Number(data.stats.winRate || 0)}%
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  (realized sells only)
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-gray-500">
                  Trades
                </p>
                <p className="mt-2 text-2xl font-extrabold">
                  {Number(data.stats.trades || 0)}
                </p>
              </div>
            </div>

            <h3 className="text-xl font-bold mb-4">Recent Activity</h3>

            <div className="space-y-3">
              {(data.activity || []).map((a: any, i: number) => (
                <div
                  key={a.signature || i}
                  className="p-4 rounded-2xl border border-white/10 bg-black/40 backdrop-blur flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {a.symbol} · {a.side}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {a.time}
                      {a.priced === false ? " · unpriced" : ""}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-yellow-300">
                      ${Number(a.usd || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.signature ? `${String(a.signature).slice(0, 6)}…` : ""}
                    </div>
                  </div>
                </div>
              ))}

              {(data.activity || []).length === 0 && (
                <div className="p-4 rounded-2xl border border-white/10 bg-black/40 text-gray-400">
                  No recent swap activity found in the last 30 days.
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
