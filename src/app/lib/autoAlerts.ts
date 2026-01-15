import { AlertRule, getAlerts } from "./alertsEngine";
import { SmartMoneyResult } from "./smartMoney";

type FiredMap = Record<string, number>;
const FIRED_KEY = "jupiterpulse-fired-alerts";

function getFired(): FiredMap {
  if (typeof window === "undefined") return {};
  return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
}

function markFired(id: string) {
  const fired = getFired();
  fired[id] = Date.now();
  localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
}

function canFire(id: string, cooldownMs = 60_000) {
  const fired = getFired();
  if (!fired[id]) return true;
  return Date.now() - fired[id] > cooldownMs;
}

export function evaluateTokenAlerts(
  symbol: string,
  smartMoney: SmartMoneyResult
) {
  const alerts = getAlerts().filter(
    (a) => a.type === "TOKEN" && a.target === symbol
  );

  alerts.forEach((alert) => {
    if (!canFire(alert.id)) return;

    if (smartMoney.score >= 65) {
      fire(
        alert.id,
        `${symbol} Smart Money Bullish`,
        `Index: ${smartMoney.score} — Smart money accumulating`
      );
    }

    if (smartMoney.score <= 35) {
      fire(
        alert.id,
        `${symbol} Smart Money Bearish`,
        `Index: ${smartMoney.score} — Distribution detected`
      );
    }
  });
}

function fire(id: string, title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, { body });
  markFired(id);
}
