export type SmartMoneyResult = {
  score: number;
  bias: "Bullish" | "Neutral" | "Bearish";
  confidence: number;
  breakdown: {
    momentum: number;
    riskAdjustment: number;
    signalStrength: number;
  };
};

type Input = {
  priceChangePct: number;
  riskScore: number;
  signalConfidence: number;
};

export function computeSmartMoneyIndex({
  priceChangePct,
  riskScore,
  signalConfidence,
}: Input): SmartMoneyResult {
  // Normalize momentum (-15% → +15%) → 0–100
  const momentum = Math.max(
    0,
    Math.min(100, 50 + priceChangePct * 3)
  );

  // Risk penalizes score (high risk = lower smart money)
  const riskAdjustment = Math.max(
    0,
    Math.min(100, 100 - riskScore)
  );

  const signalStrength = Math.max(
    0,
    Math.min(100, signalConfidence)
  );

  // Weighted blend
  const score = Math.round(
    momentum * 0.45 +
      signalStrength * 0.35 +
      riskAdjustment * 0.2
  );

  let bias: SmartMoneyResult["bias"] = "Neutral";
  if (score >= 65) bias = "Bullish";
  if (score <= 35) bias = "Bearish";

  return {
    score,
    bias,
    confidence: Math.round(
      (signalStrength + momentum) / 2
    ),
    breakdown: {
      momentum: Math.round(momentum),
      riskAdjustment: Math.round(riskAdjustment),
      signalStrength: Math.round(signalStrength),
    },
  };
}
