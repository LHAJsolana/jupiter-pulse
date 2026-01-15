"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function WalletsPage() {
  const [wallets, setWallets] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/wallets/top").then((r) => r.json()).then(setWallets);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-8">Wallet Leaderboard 🧠</h1>

      <div className="grid gap-4">
        {wallets.map((w, i) => (
          <Link
            key={w.address}
            href={`/wallets/${w.address}`}
            className="p-5 rounded-xl border border-white/10 hover:border-green-400 transition flex justify-between"
          >
            <div>
              <div className="font-bold">
                #{i + 1} · {w.address}
              </div>
              <div className="text-sm text-gray-400">
                {w.type} Wallet · Win rate {w.winRate}%
              </div>
            </div>

            <div className="text-green-400 font-semibold">
              ${w.totalVolume.toLocaleString()}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
