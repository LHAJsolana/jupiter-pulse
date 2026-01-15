"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function WalletPage() {
  const { address } = useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/wallets/${address}`).then((r) => r.json()).then(setData);
  }, [address]);

  if (!data) return <div className="p-10">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">{data.address}</h1>

      <div className="grid grid-cols-3 gap-4 my-8">
        <div className="p-4 rounded-xl border border-white/10">
          Volume<br />
          <strong>${data.stats.totalVolume.toLocaleString()}</strong>
        </div>
        <div className="p-4 rounded-xl border border-white/10">
          Win Rate<br />
          <strong>{data.stats.winRate}%</strong>
        </div>
        <div className="p-4 rounded-xl border border-white/10">
          Trades<br />
          <strong>{data.stats.trades}</strong>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Recent Activity</h2>

      <div className="space-y-3">
        {data.activity.map((a: any, i: number) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-white/10 flex justify-between"
          >
            <div>
              {a.symbol} · {a.side}
            </div>
            <div className="text-green-400">
              ${a.usd.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
