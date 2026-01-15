export type RiskLevel = "Low" | "Medium" | "High";

export function computeRisk(params: {
  change24h: number;
  volatility7d: number;
  liquidityScore: number; // 0–100 (mocked for now)
  whaleDominance: number; // %
}) {
  let score = 0;
  const factors: string[] = [];

  // Volatility
  if (params.volatility7d > 8) {
    score += 30;
    factors.push("High recent volatility");
  } else if (params.volatility7d > 4) {
    score += 15;
    factors.push("Moderate volatility");
  }

  // 24h move
  if (Math.abs(params.change24h) > 10) {
    score += 25;
    factors.push("Large 24h price move");
  }

  // Liquidity
  if (params.liquidityScore < 40) {
    score += 25;
    factors.push("Low liquidity depth");
  }

  // Whale dominance
  if (params.whaleDominance > 45) {
    score += 20;
    factors.push("High whale concentration");
  }

  score = Math.min(100, score);

  let level: RiskLevel = "Low";
  if (score >= 70) level = "High";
  else if (score >= 40) level = "Medium";

  return {
    score,
    level,
    factors,
  };
}
