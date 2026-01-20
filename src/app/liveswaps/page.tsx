"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type MarketRow = {
  symbol: string;
  price: number | null;
  change24h: number | null;
};

type Alert = {
  id: string;
  message: string;
  kind: "whale" | "spike" | "info";
};

type SortMode = "change" | "price" | "symbol";

function formatPrice(price: number | null) {
  if (price === null || !Number.isFinite(price)) return "—";
  if (price >= 100) return `$${price.toFixed(2)}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.01) return `$${price.toFixed(6)}`;
  return `$${price.toPrecision(4)}`;
}

function formatChange(change: number | null) {
  if (change === null || !Number.isFinite(change)) return "—";
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// A simple “pulse score” from 24h change (0..100)
function pulseScore(change24h: number | null) {
  if (change24h === null || !Number.isFinite(change24h)) return 50;
  return clamp(Math.round(50 + change24h * 2), 0, 100);
}

function pillColor(score: number) {
  if (score >= 70) return "bg-red-500 text-white";
  if (score >= 55) return "bg-green-400 text-black";
  if (score >= 35) return "bg-gray-400 text-black";
  return "bg-red-900 text-white";
}

export default function LiveSwapsPage() {
  // NOTE: we keep the route /liveswaps as-is for your homepage link,
  // but it is now "Live Market Pulse" based on /api/market.
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>("change");
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Track last change values to detect spikes
  const prevChange = useRef<Record<string, number>>({});
  const lastSpikeAt = useRef<Record<string, number>>({});

  // User-tunable thresholds
  const [spikeThreshold, setSpikeThreshold] = useState(2.5); // % delta in change24h vs previous pull
  const [whaleThreshold, setWhaleThreshold] = useState(8.0); // absolute 24h change threshold

  function pushAlert(message: string, kind: Alert["kind"]) {
    const id = Math.random().toString(36).slice(2);
    setAlerts((prev) => [...prev, { id, message, kind }]);

    window.setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 5200);
  }

  async function loadMarket() {
    try {
      setError(false);
      const res = await fetch("/api/market", { cache: "no-store" });
      const data = await res.json();

      if (!Array.isArray(data)) {
        setError(true);
        return;
      }

      // normalize
      const normalized: MarketRow[] = data.map((x: any) => ({
        symbol: String(x?.symbol ?? ""),
        price: typeof x?.price === "number" ? x.price : null,
        change24h:
          typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.change24h === "number"
            ? x.change24h
            : typeof x?.usd_24h_change === "number"
            ? x.usd_24h_change
            : typeof x?.change === "number"
            ? x.change
            : null,
      }));

      // Detect spikes & whale-style alerts
      const now = Date.now();
      normalized.forEach((r) => {
        const ch = r.change24h;
        if (ch === null || !Number.isFinite(ch) || !r.symbol) return;

        const prev = prevChange.current[r.symbol];
        if (typeof prev === "number") {
          const delta = ch - prev;
          const absDelta = Math.abs(delta);

          // Spike alert (rate-limited per symbol)
          const last = lastSpikeAt.current[r.symbol] ?? 0;
          if (absDelta >= spikeThreshold && now - last > 12_000) {
            pushAlert(
              `📈 Spike · ${r.symbol} change moved ${delta >= 0 ? "+" : ""}${delta.toFixed(
                2
              )}% (24h)`,
              "spike"
            );
            lastSpikeAt.current[r.symbol] = now;
          }
        }

        // Whale-style alert: big absolute 24h move
        if (Math.abs(ch) >= whaleThreshold) {
          const last = lastSpikeAt.current[`whale-${r.symbol}`] ?? 0;
          if (now - last > 18_000) {
            pushAlert(
              `🐳 Big move · ${r.symbol} ${ch >= 0 ? "+" : ""}${ch.toFixed(
                2
              )}% (24h)`,
              "whale"
            );
            lastSpikeAt.current[`whale-${r.symbol}`] = now;
          }
        }

        prevChange.current[r.symbol] = ch;
      });

      setRows(normalized.filter((r) => r.symbol));
      setLastUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // auto refresh
  useEffect(() => {
    loadMarket();
    if (!live) return;

    const interval = window.setInterval(loadMarket, 12_000);
    return () => window.clearInterval(interval);
  }, [live, spikeThreshold, whaleThreshold]);

  const sorted = useMemo(() => {
    const copy = [...rows];

    if (sortMode === "price") {
      return copy.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    }

    if (sortMode === "symbol") {
      return copy.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }

    // default change
    return copy.sort(
      (a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity)
    );
  }, [rows, sortMode]);

  return (
    <div className="min-h-screen">
      {/* Sticky nav */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-gray-300 hover:text-white transition"
            >
              ← Home
            </Link>
            <span className="text-gray-600">/</span>
            <div className="font-extrabold tracking-tight">
              Live Market Pulse <span className="text-[var(--accent)]">🐳</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/pulse"
              className="text-sm px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              Pulse
            </Link>
            <Link
              href="/signals"
              className="text-sm px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              Signals
            </Link>

            <button
              onClick={() => setLive((v) => !v)}
              className={[
                "ml-1 text-sm px-3 py-1.5 rounded-full border transition font-semibold",
                live
                  ? "bg-[var(--accent)] text-black border-transparent"
                  : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10",
              ].join(" ")}
            >
              {live ? "LIVE" : "PAUSED"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-10 pb-16">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-extrabold">Live Market Pulse</h1>
            <p className="text-gray-400 mt-2">
              Real-time market snapshot from{" "}
              <span className="text-gray-200 font-semibold">/api/market</span>
              {lastUpdated && (
                <span className="ml-2 text-xs text-gray-500">
                  · updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>

          <button
            onClick={loadMarket}
            className="text-sm px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition"
          >
            Refresh
          </button>
        </div>

        {/* Controls */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-gray-400">Sort</div>
            <div className="mt-2 flex gap-2 flex-wrap">
              {[
                { key: "change", label: "📈 Change" },
                { key: "price", label: "💰 Price" },
                { key: "symbol", label: "🔤 Symbol" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortMode(s.key as SortMode)}
                  className={[
                    "px-3 py-1.5 rounded-full text-sm font-semibold transition border",
                    sortMode === s.key
                      ? "bg-[var(--accent)] text-black border-transparent"
                      : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10",
                  ].join(" ")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-gray-400">Spike threshold</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <input
                type="range"
                min={0.5}
                max={8}
                step={0.5}
                value={spikeThreshold}
                onChange={(e) => setSpikeThreshold(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-sm font-semibold text-gray-200 w-16 text-right">
                {spikeThreshold.toFixed(1)}%
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Alert when 24h change moves by ≥ this amount between refreshes.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-gray-400">Big move threshold</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <input
                type="range"
                min={2}
                max={20}
                step={1}
                value={whaleThreshold}
                onChange={(e) => setWhaleThreshold(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-sm font-semibold text-gray-200 w-16 text-right">
                {whaleThreshold.toFixed(0)}%
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Whale-style alert for assets with big 24h moves.
            </div>
          </div>
        </div>

        {/* States */}
        {loading && (
          <div className="mt-10 text-gray-400 animate-pulse">
            Loading market…
          </div>
        )}

        {error && !loading && (
          <div className="mt-10 text-red-400">
            ✕ Failed to load <span className="text-white">/api/market</span>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {sorted.map((r) => {
              const score = pulseScore(r.change24h);
              return (
                <Link
                  key={r.symbol}
                  href={`/pulse/${r.symbol}`}
                  className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:border-[var(--accent)]/40 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-extrabold">{r.symbol}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        Price{" "}
                        <span className="text-gray-200 font-semibold">
                          {formatPrice(r.price)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        24h{" "}
                        <span
                          className={[
                            "font-semibold",
                            (r.change24h ?? 0) >= 0
                              ? "text-green-400"
                              : "text-red-400",
                          ].join(" ")}
                        >
                          {formatChange(r.change24h)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={[
                          "text-xs px-2 py-1 rounded-full font-bold",
                          pillColor(score),
                        ].join(" ")}
                        title="Pulse score from 24h change"
                      >
                        Pulse · {score}
                      </span>
                      <div className="mt-2 text-xs text-gray-500">
                        View details →
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Alert stack */}
      <div className="fixed top-6 right-6 space-y-3 z-50">
        {alerts.map((a) => (
          <div
            key={a.id}
            className={[
              "px-4 py-3 rounded-xl border shadow-lg bg-black/80 backdrop-blur",
              "animate-[toastIn_180ms_ease-out]",
              a.kind === "whale"
                ? "border-purple-400/40"
                : a.kind === "spike"
                ? "border-[var(--accent)]/40"
                : "border-white/20",
            ].join(" ")}
          >
            <div className="text-sm text-gray-100">{a.message}</div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
