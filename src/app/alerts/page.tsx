"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  getAlerts,
  removeAlert,
  saveAlert,
  AlertRule,
  AlertType,
} from "../lib/alertsEngine";

function shortTarget(type: AlertType, target: string) {
  if (type === "TOKEN") return target.toUpperCase();
  return target.length > 14 ? `${target.slice(0, 6)}...${target.slice(-4)}` : target;
}

function conditionLabel(alert: AlertRule) {
  if (alert.condition === "price-above") return `Price above ${alert.threshold ?? "?"}`;
  if (alert.condition === "price-below") return `Price below ${alert.threshold ?? "?"}`;
  if (alert.condition === "large-swap") return `Large swap above $${Number(alert.threshold ?? 0).toLocaleString()}`;
  if (alert.condition === "smart-money") return "Smart money shift";
  return "Watchlist";
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRule[]>(() => getAlerts());
  const [type, setType] = useState<AlertType>("TOKEN");
  const [target, setTarget] = useState("");
  const [condition, setCondition] = useState<AlertRule["condition"]>("watch");
  const [threshold, setThreshold] = useState("");

  const tokenAlerts = useMemo(() => alerts.filter((a) => a.type === "TOKEN"), [alerts]);
  const walletAlerts = useMemo(() => alerts.filter((a) => a.type === "WALLET"), [alerts]);

  function refresh() {
    setAlerts(getAlerts());
  }

  function addAlert() {
    const cleanTarget = target.trim();
    if (!cleanTarget) return;

    saveAlert({
      id: crypto.randomUUID(),
      type,
      target: type === "TOKEN" ? cleanTarget.toUpperCase() : cleanTarget,
      condition,
      threshold: threshold ? Number(threshold) : undefined,
      createdAt: Date.now(),
    });

    setTarget("");
    setThreshold("");
    refresh();
  }

  function deleteAlert(id: string) {
    removeAlert(id);
    refresh();
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-white/45">
            <Link href="/" className="hover:text-white">Home</Link> / Alerts
          </div>
          <h1 className="mt-3 text-4xl font-extrabold">Watchlist & Alerts</h1>
          <p className="mt-2 text-sm text-white/55 max-w-2xl">
            Local watchlists for followed tokens, wallets, price thresholds, and large-swap monitoring.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[140px_1fr_190px_160px_auto] gap-3">
          <div className="flex gap-2">
            {(["TOKEN", "WALLET"] as const).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => {
                  setType(x);
                  setCondition(x === "TOKEN" ? "watch" : "large-swap");
                }}
                className={[
                  "px-3 py-2 rounded-xl border text-sm font-semibold",
                  type === x
                    ? "border-green-400/40 bg-green-400/10 text-green-100"
                    : "border-white/10 bg-white/5 text-white/65",
                ].join(" ")}
              >
                {x}
              </button>
            ))}
          </div>

          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={type === "TOKEN" ? "Token symbol, e.g. SOL" : "Wallet address"}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none focus:border-white/25"
          />

          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none focus:border-white/25"
          >
            {type === "TOKEN" ? (
              <>
                <option value="watch">Follow token</option>
                <option value="smart-money">Smart money shift</option>
                <option value="price-above">Price above</option>
                <option value="price-below">Price below</option>
              </>
            ) : (
              <>
                <option value="watch">Follow wallet</option>
                <option value="large-swap">Large swap</option>
              </>
            )}
          </select>

          <input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            type="number"
            min="0"
            placeholder={condition === "large-swap" ? "USD size" : "Price"}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm outline-none focus:border-white/25 disabled:opacity-40"
            disabled={condition === "watch" || condition === "smart-money"}
          />

          <button
            type="button"
            onClick={addAlert}
            className="px-4 py-2 rounded-xl border border-green-400/30 bg-green-400/10 hover:bg-green-400/15 text-sm font-semibold text-green-100"
          >
            Add
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertColumn title="Followed Tokens" alerts={tokenAlerts} onDelete={deleteAlert} />
        <AlertColumn title="Followed Wallets" alerts={walletAlerts} onDelete={deleteAlert} />
      </div>
    </div>
  );
}

function AlertColumn({
  title,
  alerts,
  onDelete,
}: {
  title: string;
  alerts: AlertRule[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <span className="text-xs text-white/45">{alerts.length} saved</span>
      </div>

      <div className="mt-4 grid gap-3">
        {alerts.map((a) => (
          <div
            key={a.id}
            className="rounded-xl border border-white/10 bg-black/30 p-4 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="font-bold truncate">{shortTarget(a.type, a.target)}</div>
              <div className="mt-1 text-sm text-white/55">{conditionLabel(a)}</div>
            </div>
            <button
              type="button"
              onClick={() => onDelete(a.id)}
              className="text-sm text-red-300 hover:text-red-200"
            >
              Remove
            </button>
          </div>
        ))}

        {alerts.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">
            Nothing saved yet.
          </div>
        )}
      </div>
    </div>
  );
}
