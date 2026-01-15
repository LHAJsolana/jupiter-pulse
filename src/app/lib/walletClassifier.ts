export type WalletType = "Whale" | "Smart" | "Fresh";

export function classifyWallet(stats: {
  totalVolume: number;
  winRate: number;
  ageDays: number;
}) {
  if (stats.totalVolume > 1_000_000) {
    return { type: "Whale" as WalletType, confidence: 90 };
  }

  if (stats.winRate > 60 && stats.totalVolume > 100_000) {
    return { type: "Smart" as WalletType, confidence: 75 };
  }

  return { type: "Fresh" as WalletType, confidence: 60 };
}
