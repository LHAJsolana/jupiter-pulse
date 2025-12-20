"use client";

import { usePulse } from "./hooks/usePulse";

export default function Home() {
  const { data, loading } = usePulse();

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      {loading ? (
        <p className="text-gray-400">Loading Jupiter Pulse…</p>
      ) : (
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">⚡ Jupiter Pulse</h1>
          <p className="text-lg text-gray-300">
            Solana sentiment: {data.pulse.solana.sentiment}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Trending: {data.pulse.trending.join(", ")}
          </p>
        </div>
      )}
    </main>
  );
}
