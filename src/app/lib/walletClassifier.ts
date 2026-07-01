export type WalletType = "Whale" | "Smart" | "Fresh";

export type TraderProfile = {
  label: string;
  score: number;
  confidence: "Low" | "Medium" | "High";
  tone: "green" | "amber" | "red" | "neutral";
  summary: string;
  strengths: string[];
  risks: string[];
};

export type TraderProfileInput = {
  realizedPnl: number;
  winRate: number;
  avgHoldHours: number;
  realizedTrades: number;
  totalTrades: number;
  avgTradeUsd: number;
  largestTradeUsd: number;
  tradesPerDay: number;
  avgWinUsd: number;
  avgLossUsd: number;
  soldEarlyTotal: number;
  boughtLateTotal: number;
  pricedSwaps: number;
  unpricedSwaps: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

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

export function classifyTraderProfile(params: TraderProfileInput): TraderProfile {
  const strengths: string[] = [];
  const risks: string[] = [];

  let score = 50;
  const isWhale = params.avgTradeUsd >= 5_000 || params.largestTradeUsd >= 25_000;
  const isVeryActive = params.tradesPerDay >= 8 || params.totalTrades >= 80;
  const isBagholder = params.avgHoldHours >= 240 && params.realizedPnl < 0;
  const isApe =
    params.avgHoldHours < 6 &&
    params.winRate < 45 &&
    params.realizedPnl < 0 &&
    params.boughtLateTotal > params.soldEarlyTotal;

  if (params.realizedTrades === 0) {
    return {
      label: isWhale ? "Whale Watch Mode" : "Watch Mode",
      score: 45,
      confidence: params.pricedSwaps >= 5 ? "Medium" : "Low",
      tone: isWhale ? "amber" : "neutral",
      summary:
        "We found activity, but not enough priced realized sells to judge execution quality yet.",
      strengths: [
        ...(params.pricedSwaps > 0 ? ["Priced swaps detected"] : []),
        ...(isWhale ? ["Large trade sizing detected"] : []),
      ],
      risks: ["Needs realized sells before PnL and win-rate behavior are meaningful"],
    };
  }

  if (params.realizedPnl > 0) {
    score += 12;
    strengths.push("Positive realized PnL");
  } else if (params.realizedPnl < 0) {
    score -= 12;
    risks.push("Negative realized PnL");
  }

  if (params.winRate >= 60) {
    score += 12;
    strengths.push("Strong realized win rate");
  } else if (params.winRate < 40) {
    score -= 10;
    risks.push("Low realized win rate");
  }

  if (params.avgWinUsd > params.avgLossUsd && params.avgLossUsd > 0) {
    score += 10;
    strengths.push("Average win is larger than average loss");
  } else if (params.avgLossUsd > params.avgWinUsd && params.avgWinUsd > 0) {
    score -= 10;
    risks.push("Average loss is larger than average win");
  }

  if (params.avgHoldHours >= 6 && params.avgHoldHours <= 120) {
    score += 6;
    strengths.push("Hold time looks measured");
  } else if (params.avgHoldHours > 0 && params.avgHoldHours < 2) {
    score -= 5;
    risks.push("Very short average hold time");
  } else if (params.avgHoldHours > 240) {
    score -= 4;
    risks.push("Long holds can turn into passive bagholding");
  }

  if (isWhale) {
    strengths.push("Large trade sizing");
    score += params.realizedPnl > 0 ? 4 : 0;
  }

  if (isVeryActive) {
    risks.push("High trade frequency");
    score -= params.realizedPnl < 0 ? 8 : 2;
  }

  const missedTotal = params.soldEarlyTotal + params.boughtLateTotal;
  const missedPressure =
    Math.abs(params.realizedPnl) > 0
      ? missedTotal / Math.max(1, Math.abs(params.realizedPnl))
      : missedTotal > 0
        ? 1
        : 0;

  if (missedPressure > 1.5) {
    score -= 10;
    risks.push("Large missed-money pressure versus realized PnL");
  } else if (missedTotal === 0 && params.realizedTrades >= 3) {
    score += 4;
    strengths.push("No major missed-money pattern detected");
  }

  const pricedCoverage = params.pricedSwaps / Math.max(1, params.pricedSwaps + params.unpricedSwaps);
  if (pricedCoverage < 0.35) risks.push("Low priced-swap coverage, so the profile is less certain");

  score = clamp(Math.round(score), 0, 100);

  let label = "Mixed Trader";
  let tone: TraderProfile["tone"] = "neutral";
  let summary = "The wallet shows mixed execution quality across the analyzed swaps.";

  if (isWhale && score >= 65 && params.realizedPnl > 0) {
    label = "Whale Rotator";
    tone = "green";
    summary = "This wallet moves meaningful size while keeping realized outcomes healthy.";
  } else if (isWhale && score < 50) {
    label = "Whale Under Pressure";
    tone = "amber";
    summary = "This wallet moves meaningful size, but the realized behavior is not clean yet.";
  } else if (isBagholder) {
    label = "Bagholder";
    tone = "red";
    summary = "This wallet tends to hold losing positions for a long time before realizing outcomes.";
  } else if (isApe) {
    label = "Ape Mode";
    tone = "red";
    summary = "This wallet shows fast, loss-prone entries with signs of chasing weakness.";
  } else if (score >= 75 && params.realizedPnl > 0) {
    label = "Disciplined Winner";
    tone = "green";
    summary = "This wallet shows strong realized execution with healthier trade outcomes.";
  } else if (score >= 62) {
    label = isVeryActive ? "Active Rotator" : "Selective Rotator";
    tone = "green";
    summary = "This wallet appears selective, with decent execution and controlled behavior.";
  } else if (params.avgHoldHours < 2 && params.totalTrades >= 8) {
    label = "Fast Scalper";
    tone = score >= 50 ? "amber" : "red";
    summary = "This wallet trades quickly, so execution quality depends heavily on timing and fees.";
  } else if (missedPressure > 1.5) {
    label = "Early Exiter";
    tone = "amber";
    summary = "This wallet leaves noticeable value behind after entries or exits.";
  } else if (score <= 35) {
    label = "Leak-Prone Trader";
    tone = "red";
    summary = "This wallet shows weak realized outcomes and needs tighter execution rules.";
  }

  const confidence =
    params.realizedTrades >= 8 && pricedCoverage >= 0.55
      ? "High"
      : params.realizedTrades >= 3 && pricedCoverage >= 0.35
        ? "Medium"
        : "Low";

  return {
    label,
    score,
    confidence,
    tone,
    summary,
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 4),
  };
}
