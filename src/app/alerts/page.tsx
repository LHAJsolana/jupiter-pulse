"use client";

import { useEffect, useState } from "react";
import {
  getAlerts,
  removeAlert,
  AlertRule,
} from "../lib/alertsEngine";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);

  useEffect(() => {
    setAlerts(getAlerts());
  }, []);

  function deleteAlert(id: string) {
    removeAlert(id);
    setAlerts(getAlerts());
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-6">Alerts 🔔</h1>

      {alerts.length === 0 && (
        <p className="text-gray-400">
          No alerts yet. Follow a token or wallet to get started.
        </p>
      )}

      <div className="space-y-4">
        {alerts.map((a) => (
          <div
            key={a.id}
            className="p-4 rounded-xl border border-white/10 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">
                {a.type === "TOKEN" ? "Token" : "Wallet"} Alert
              </div>
              <div className="text-sm text-gray-400">
                {a.target}
              </div>
            </div>

            <button
              onClick={() => deleteAlert(a.id)}
              className="text-red-400 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
