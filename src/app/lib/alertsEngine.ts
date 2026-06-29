export type AlertType = "TOKEN" | "WALLET";

export type AlertRule = {
  id: string;
  type: AlertType;
  target: string; // symbol or wallet address
  condition: "watch" | "smart-money" | "price-above" | "price-below" | "large-swap" | string;
  threshold?: number;
  createdAt: number;
};

const STORAGE_KEY = "jupiterpulse-alerts";

export function getAlerts(): AlertRule[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveAlert(alert: AlertRule) {
  const alerts = getAlerts();
  const exists = alerts.some(
    (a) => a.type === alert.type && a.target === alert.target && a.condition === alert.condition
  );
  if (exists) return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...alerts, alert])
  );
}

export function removeAlert(id: string) {
  const alerts = getAlerts().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function hasAlert(type: AlertType, target: string) {
  return getAlerts().some(
    (a) => a.type === type && a.target === target
  );
}

export function triggerNotification(title: string, body: string) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, { body });
      }
    });
  }
}
