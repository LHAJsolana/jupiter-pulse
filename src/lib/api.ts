export const idMap: Record<string, string> = {
  sol: "solana",
  eth: "ethereum",
  btc: "bitcoin",
  bonk: "bonk",
  sui: "sui",
  apt: "aptos",
  // add more later
};

export type MissedMoneySummary = {
  wallet: string;
  rangeDays: number;
  totalMissedUsd: number;
  modules: Array<{
    key: "routing" | "limit" | "funding" | "idle";
    title: string;
    missedUsd: number;
    note: string;
  }>;
  events: Array<{
    ts: number;
    type: "routing" | "limit" | "borrow" | "idle";
    title: string;
    detail: string;
    missedUsd: number;
  }>;
};

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}
