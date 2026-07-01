// FILE: src/app/api/wallet-review/route.ts
import { NextResponse } from "next/server";
import { sampleSpotWindow } from "@/lib/candles";
import {
  chooseTradedToken,
  fetchHeliusTransactions,
  normalizeSymbol,
  parseHeliusSwaps,
  type SwapLike,
} from "@/lib/walletSwaps";
import { classifyTraderProfile } from "@/app/lib/walletClassifier";

type Trade = {
  id: string;
  ts: number;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  usd: number;
  entry: number;
  exit: number;
  pnlUsd: number;
  pnlPct: number;
  timeInHours: number;
  missedUpsideUsd: number;
  ateDrawdownUsd: number;
  realized: boolean;
  matchedQty: number;
  costBasisCoveragePct: number;
};

type Lot = { qty: number; costUsd: number; ts: number };

type DataQuality = {
  score: number;
  level: "Low" | "Medium" | "High";
  pricedSwapPct: number;
  unpricedSwapPct: number;
  summary: string;
  checks: Array<{ label: string; value: string; ok: boolean }>;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function fmtAddress(a: string) {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function computeFromSwaps(swaps: SwapLike[], cutoffSec: number | null) {
  const lotsBySymbol = new Map<string, Lot[]>();
  const trades: Trade[] = [];

  let realizedPnl = 0;
  let realizedWins = 0;
  let realizedLosses = 0;
  let sumWinUsd = 0;
  let sumLossUsd = 0;
  let sumHoldHours = 0;
  let realizedCount = 0;

  const ordered = [...swaps].sort((a, b) => a.ts - b.ts);

  for (const s of ordered) {
    const inWindow = cutoffSec === null || s.ts >= cutoffSec;
    const tradedToken = chooseTradedToken(s.inputSym, s.outputSym);

    const inputSym = s.inputSym ? normalizeSymbol(s.inputSym) : null;
    const outputSym = s.outputSym ? normalizeSymbol(s.outputSym) : null;

    const receivesToken = outputSym === tradedToken;
    const sendsToken = inputSym === tradedToken;

    const qty = receivesToken ? s.outputAmt : sendsToken ? s.inputAmt : 0;

    const usd = s.usdValue > 0 ? s.usdValue : 0;
    if (qty <= 0 || usd <= 0) continue;

    const price = usd / qty;

    if (receivesToken && !sendsToken) {
      const lots = lotsBySymbol.get(tradedToken) || [];
      lots.push({ qty, costUsd: usd, ts: s.ts });
      lotsBySymbol.set(tradedToken, lots);

      if (inWindow) trades.push({
        id: s.signature,
        ts: s.ts,
        symbol: tradedToken,
        side: "BUY",
        qty,
        usd: Math.round(usd),
        entry: price,
        exit: price,
        pnlUsd: 0,
        pnlPct: 0,
        timeInHours: 0,
        missedUpsideUsd: 0,
        ateDrawdownUsd: 0,
        realized: false,
        matchedQty: 0,
        costBasisCoveragePct: 0,
      });
    } else if (sendsToken && !receivesToken) {
      const lots = lotsBySymbol.get(tradedToken) || [];
      let remaining = qty;

      let costUsed = 0;
      let matchedQty = 0;
      let oldestLotTs = 0;

      while (remaining > 1e-12 && lots.length) {
        const lot = lots[0];
        if (!oldestLotTs) oldestLotTs = lot.ts;

        const takeQty = Math.min(lot.qty, remaining);
        const takeCost = (lot.costUsd * takeQty) / lot.qty;

        costUsed += takeCost;
        matchedQty += takeQty;
        lot.qty -= takeQty;
        lot.costUsd -= takeCost;
        remaining -= takeQty;

        if (lot.qty <= 1e-12) lots.shift();
      }

      lotsBySymbol.set(tradedToken, lots);

      let pnlUsd = 0;
      let pnlPct = 0;
      let holdHours = 0;

      if (costUsed > 0 && matchedQty > 0) {
        // Only compare the matched part of the sale with observed cost basis.
        // This prevents sells whose buys predate our fetched history from
        // appearing artificially profitable.
        const matchedProceeds = usd * (matchedQty / qty);
        pnlUsd = matchedProceeds - costUsed;
        pnlPct = (pnlUsd / costUsed) * 100;

        if (inWindow) {
          realizedPnl += pnlUsd;
          realizedCount += 1;

          if (pnlUsd >= 0) {
            realizedWins += 1;
            sumWinUsd += pnlUsd;
          } else {
            realizedLosses += 1;
            sumLossUsd += Math.abs(pnlUsd);
          }

          if (oldestLotTs) {
            holdHours = Math.max(0, Math.round((s.ts - oldestLotTs) / 3600));
            sumHoldHours += holdHours;
          }
        }
      }

      if (inWindow) trades.push({
        id: s.signature,
        ts: s.ts,
        symbol: tradedToken,
        side: "SELL",
        qty,
        usd: Math.round(usd),
        entry: costUsed > 0 && matchedQty > 0 ? costUsed / matchedQty : price,
        exit: price,
        pnlUsd,
        pnlPct: clamp(pnlPct, -99.99, 9999),
        timeInHours: holdHours,
        missedUpsideUsd: 0,
        ateDrawdownUsd: 0,
        realized: costUsed > 0 && matchedQty > 0,
        matchedQty,
        costBasisCoveragePct: qty > 0 ? clamp((matchedQty / qty) * 100, 0, 100) : 0,
      });
    }
  }

  const winRate = realizedCount ? Math.round((realizedWins / realizedCount) * 100) : 0;
  const avgHoldHours = realizedCount ? Math.round(sumHoldHours / realizedCount) : 0;
  const avgWinUsd = realizedWins ? sumWinUsd / realizedWins : 0;
  const avgLossUsd = realizedLosses ? sumLossUsd / realizedLosses : 0;

  return {
    trades,
    realizedPnl,
    winRate,
    avgHoldHours,
    avgWinUsd,
    avgLossUsd,
    realizedCount,
  };
}

function rangeDaysFor(range: string) {
  if (range === "7D") return 7;
  if (range === "90D") return 90;
  if (range === "ALL") return 180;
  return 30;
}

function confidenceForCount(count: number, coveragePct: number) {
  if (count >= 8 && coveragePct >= 55) return "High" as const;
  if (count >= 3 && coveragePct >= 35) return "Medium" as const;
  return "Low" as const;
}

function computeMissedHeuristic(params: { trades: Trade[]; lookaheadHours: number }) {
  const { trades, lookaheadHours } = params;

  const ordered = [...trades].sort((a, b) => a.ts - b.ts);
  const lookaheadSec = Math.max(1, Math.floor(lookaheadHours * 3600));

  const withMissed: Trade[] = ordered.map((t) => ({ ...t }));

  // Index by symbol for faster scan
  const idxBySymbol = new Map<string, number[]>();
  for (let i = 0; i < withMissed.length; i++) {
    const sym = withMissed[i].symbol;
    const arr = idxBySymbol.get(sym) || [];
    arr.push(i);
    idxBySymbol.set(sym, arr);
  }

  let soldEarlyTotal = 0;
  let boughtLateTotal = 0;

  for (const idxs of idxBySymbol.values()) {
    for (let k = 0; k < idxs.length; k++) {
      const i = idxs[k];
      const t = withMissed[i];
      const startTs = t.ts;
      const endTs = startTs + lookaheadSec;

      // Build future price path from subsequent trades only (proxy)
      // For BUY: future min price from later trades
      // For SELL: future max price from later trades
      let futureMin = Number.POSITIVE_INFINITY;
      let futureMax = 0;

      for (let kk = k + 1; kk < idxs.length; kk++) {
        const j = idxs[kk];
        const u = withMissed[j];
        if (u.ts > endTs) break;

        // Use a conservative "trade price" proxy:
        // - BUY price = entry
        // - SELL price = exit
        const price = u.side === "BUY" ? u.entry : u.exit;
        if (price > 0) {
          futureMin = Math.min(futureMin, price);
          futureMax = Math.max(futureMax, price);
        }
      }

      if (t.side === "SELL") {
        const exit = t.exit;
        if (exit > 0 && futureMax > exit && t.qty > 0) {
          const missed = (futureMax - exit) * t.qty;
          const capped = clamp(missed, 0, t.usd * 10); // sanity cap
          t.missedUpsideUsd = capped;
          soldEarlyTotal += capped;
        }
      }

      if (t.side === "BUY") {
        const entry = t.entry;
        if (entry > 0 && Number.isFinite(futureMin) && futureMin < entry && t.qty > 0) {
          const ate = (entry - futureMin) * t.qty;
          const capped = clamp(ate, 0, t.usd * 10); // sanity cap
          t.ateDrawdownUsd = capped;
          boughtLateTotal += capped;
        }
      }
    }
  }

  const earlySells = withMissed
    .filter((t) => t.side === "SELL" && t.missedUpsideUsd > 0)
    .sort((a, b) => b.missedUpsideUsd - a.missedUpsideUsd)
    .slice(0, 12);

  const lateBuys = withMissed
    .filter((t) => t.side === "BUY" && t.ateDrawdownUsd > 0)
    .sort((a, b) => b.ateDrawdownUsd - a.ateDrawdownUsd)
    .slice(0, 12);

  return {
    soldEarlyTotal,
    boughtLateTotal,
    earlySells,
    lateBuys,
  };
}

function buildTips(summary: {
  winRate: number;
  avgWinUsd: number;
  avgLossUsd: number;
  realizedTrades: number;
  pricedSwaps: number;
  unpricedSwaps: number;
  soldEarlyTotal: number;
  boughtLateTotal: number;
}) {
  const tips: string[] = [];

  if (summary.pricedSwaps === 0 && summary.unpricedSwaps > 0) {
    tips.push(
      "We found swaps, but many are unpriced (no USD value). This usually happens when swaps are token→token with no SOL/USDC/USDT leg."
    );
  }

  if (summary.realizedTrades < 3) tips.push("Not enough realized sells yet → need more SELLs to judge performance.");
  else {
    if (summary.avgLossUsd > summary.avgWinUsd) tips.push("Avg loss > avg win → tighten stops or take partials earlier.");
    else tips.push("Avg win > avg loss → repeat best setups and avoid overtrading.");
    if (summary.winRate < 45) tips.push("Low win rate → be more selective + reduce size.");
    if (summary.winRate > 60) tips.push("Strong win rate → scale out instead of full exits.");
  }

  const missed = summary.soldEarlyTotal + summary.boughtLateTotal;
  if (missed > 0) {
    tips.push("Missed-money detected → consider planned exits + avoid panic entries (heuristic based on your own swap prices).");
  }

  tips.push("Candles-grade missed money attribution will be computed in /api/missed-money next.");
  tips.push("Pre-plan entry/stop/targets before swapping — consistency beats speed.");

  return tips.slice(0, 6);
}

function buildDataQuality(params: {
  swapsDetected: number;
  pricedSwaps: number;
  unpricedSwaps: number;
  pagesFetched: number;
  txFetched: number;
  source: string;
  spotSampleOk: boolean;
}): DataQuality {
  const total = Math.max(1, params.swapsDetected);
  const pricedSwapPct = Math.round((params.pricedSwaps / total) * 100);
  const unpricedSwapPct = Math.max(0, 100 - pricedSwapPct);

  let score = 35;
  score += Math.min(35, Math.round(pricedSwapPct * 0.35));
  score += params.swapsDetected >= 10 ? 15 : params.swapsDetected >= 3 ? 8 : 0;
  score += params.pagesFetched >= 2 ? 8 : params.pagesFetched === 1 ? 4 : 0;
  score += params.spotSampleOk ? 7 : 0;
  score = clamp(score, 0, 100);

  const level: DataQuality["level"] = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";

  return {
    score,
    level,
    pricedSwapPct,
    unpricedSwapPct,
    summary:
      level === "High"
        ? "Strong enough coverage for behavior-level conclusions."
        : level === "Medium"
          ? "Useful signal, but some conclusions should stay cautious."
          : "Limited coverage. Treat the profile as directional, not final.",
    checks: [
      { label: "Source", value: params.source, ok: true },
      { label: "Transactions fetched", value: String(params.txFetched), ok: params.txFetched > 0 },
      { label: "Helius pages", value: String(params.pagesFetched), ok: params.pagesFetched > 0 },
      { label: "Swaps detected", value: String(params.swapsDetected), ok: params.swapsDetected > 0 },
      { label: "Priced swaps", value: `${pricedSwapPct}%`, ok: pricedSwapPct >= 35 },
      { label: "Jupiter spot", value: params.spotSampleOk ? "OK" : "Unavailable", ok: params.spotSampleOk },
    ],
  };
}

/**
 * Phase 2 Step 1 replacement:
 * We no longer prefetch CoinGecko candles.
 * We do a tiny Jupiter spot sampling (SOL) to confirm Jupiter price pipeline is alive.
 */
async function spotWarmup() {
  const sampled = await sampleSpotWindow({ ids: ["SOL"], samples: 1, gapMs: 0 });
  return {
    spotSampleOk: sampled.ok,
    spotSamples: sampled.points.length,
    spotSampleNote: sampled.ok ? "Jupiter spot sampling OK" : sampled.error,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").trim();
  const range = (url.searchParams.get("range") || "30D").toUpperCase();

  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) return NextResponse.json({ error: "Missing HELIUS_API_KEY in .env.local" }, { status: 500 });

  const desired = range === "7D" ? 200 : range === "90D" ? 700 : range === "ALL" ? 1600 : 450;

  const fetched = await fetchHeliusTransactions({ address, apiKey: heliusKey, desired });

  if (!fetched.ok) {
    return NextResponse.json({ error: `Helius error ${fetched.status}: ${fetched.errorText}` }, { status: 500 });
  }

  const txs = fetched.txs;
  const days = rangeDaysFor(range);
  const cutoffSec = range === "ALL" ? null : Math.floor(Date.now() / 1000) - days * 24 * 3600;

  const {
    swaps,
    solPrice,
    jupiterPriceIdsRequested,
    jupiterPriceIdsResolved,
    jupiterEnrichedSwaps,
  } = await parseHeliusSwaps(Array.isArray(txs) ? txs : [], address);
  const windowedSwaps = cutoffSec === null ? swaps : swaps.filter((s) => s.ts >= cutoffSec);
  const computed = computeFromSwaps(swaps, cutoffSec);

  // Phase 2 (heuristic) missed money using only your own priced swap prices
  const lookaheadHours = range === "7D" ? 36 : range === "30D" ? 48 : range === "90D" ? 72 : 96;
  const missed = computeMissedHeuristic({ trades: computed.trades, lookaheadHours });

  const realizedSells = computed.trades.filter((t) => t.side === "SELL" && t.realized);
  const topTrades = realizedSells
    .filter((t) => t.pnlUsd > 0)
    .sort((a, b) => b.pnlUsd - a.pnlUsd)
    .slice(0, 5);
  const worstTrades = realizedSells
    .filter((t) => t.pnlUsd < 0)
    .sort((a, b) => a.pnlUsd - b.pnlUsd)
    .slice(0, 5);

  const pricedSwaps = windowedSwaps.filter((s) => s.priced && s.usdValue > 0).length;
  const unpricedSwaps = windowedSwaps.length - pricedSwaps;
  const pricedTrades = computed.trades.filter((t) => t.usd > 0);
  const totalTradeUsd = pricedTrades.reduce((sum, t) => sum + t.usd, 0);
  const avgTradeUsd = pricedTrades.length ? totalTradeUsd / pricedTrades.length : 0;
  const largestTradeUsd = pricedTrades.reduce((max, t) => Math.max(max, t.usd), 0);
  const oldestWindowedSwap = windowedSwaps.reduce(
    (oldest, swap) => (oldest === 0 || swap.ts < oldest ? swap.ts : oldest),
    0
  );
  const observedDays =
    range === "ALL" && oldestWindowedSwap > 0
      ? Math.max(1, (Math.floor(Date.now() / 1000) - oldestWindowedSwap) / 86_400)
      : days;
  const tradesPerDay = computed.trades.length / observedDays;

  const warm = await spotWarmup();

  const tips = buildTips({
    winRate: computed.winRate,
    avgWinUsd: computed.avgWinUsd,
    avgLossUsd: computed.avgLossUsd,
    realizedTrades: computed.realizedCount,
    pricedSwaps,
    unpricedSwaps,
    soldEarlyTotal: missed.soldEarlyTotal,
    boughtLateTotal: missed.boughtLateTotal,
  });

  const profile = classifyTraderProfile({
    realizedPnl: computed.realizedPnl,
    winRate: computed.winRate,
    avgHoldHours: computed.avgHoldHours,
    realizedTrades: computed.realizedCount,
    totalTrades: computed.trades.length,
    avgTradeUsd,
    largestTradeUsd,
    tradesPerDay,
    avgWinUsd: computed.avgWinUsd,
    avgLossUsd: computed.avgLossUsd,
    soldEarlyTotal: missed.soldEarlyTotal,
    boughtLateTotal: missed.boughtLateTotal,
    pricedSwaps,
    unpricedSwaps,
  });

  const dataQuality = buildDataQuality({
    swapsDetected: windowedSwaps.length,
    pricedSwaps,
    unpricedSwaps,
    pagesFetched: fetched.pages,
    txFetched: Array.isArray(txs) ? txs.length : 0,
    source: "Helius enhanced + Jupiter spot/mint prices",
    spotSampleOk: warm.spotSampleOk,
  });

  const summary = {
    address: fmtAddress(address),
    range,
    realizedPnl: computed.realizedPnl,
    winRate: computed.winRate,
    trades: computed.trades.length,
    avgHoldHours: computed.avgHoldHours,
    avgWinUsd: computed.avgWinUsd,
    avgLossUsd: computed.avgLossUsd,
    avgTradeUsd,
    largestTradeUsd,
    tradesPerDay,
    missedUpsideTotal: missed.soldEarlyTotal,
    ateDrawdownTotal: missed.boughtLateTotal,
    biggestWin: topTrades[0] || null,
    biggestLoss: worstTrades[0] || null,
  };

  const pricedCoveragePct = windowedSwaps.length
    ? Math.round((pricedSwaps / windowedSwaps.length) * 100)
    : 0;
  const outcomeConfidence = confidenceForCount(computed.realizedCount, pricedCoveragePct);
  const behaviorConfidence = confidenceForCount(computed.trades.length, pricedCoveragePct);

  const explainability = {
    verdict:
      computed.realizedCount === 0
        ? "Activity was found, but there are not enough matched sells to judge trading outcomes."
        : `${profile.label} is a behavioral estimate based on ${computed.realizedCount} FIFO-matched sell${computed.realizedCount === 1 ? "" : "s"} and ${pricedCoveragePct}% priced-swap coverage.`,
    methodology: [
      "Helius enhanced transactions are parsed into wallet-level swaps.",
      "USD values use explicit swap values first, then stablecoin, SOL, or Jupiter mint pricing.",
      "Realized PnL uses FIFO lots and only the portion of each sell with an observed cost basis.",
      "Behavior labels combine realized outcomes, win/loss sizing, hold time, activity, and missed-money pressure.",
    ],
    limitations: [
      "This is an observational report, not tax accounting or financial advice.",
      "Transfers, fees, airdrops, liquidity positions, and trades outside fetched history can affect cost basis.",
      "Token-to-token routes are reduced to one primary traded asset and may not describe both economic legs.",
      "Sold-early and bought-late values compare later wallet swap prices, not the full market price path.",
      ...(range === "ALL"
        ? ["ALL means all transactions returned within the current Helius pagination limit, not guaranteed lifetime history."]
        : []),
    ],
    metrics: [
      {
        key: "realizedPnl",
        label: "Realized PnL",
        confidence: outcomeConfidence,
        evidenceCount: computed.realizedCount,
        explanation: "Proceeds minus FIFO cost basis for sells with observed matching buys.",
      },
      {
        key: "winRate",
        label: "Win rate",
        confidence: outcomeConfidence,
        evidenceCount: computed.realizedCount,
        explanation: "Share of FIFO-matched sells with non-negative realized PnL.",
      },
      {
        key: "profile",
        label: "Trader profile",
        confidence: behaviorConfidence,
        evidenceCount: computed.trades.length,
        explanation: "Rule-based behavior classification; it is not a prediction of future performance.",
      },
      {
        key: "missedMoney",
        label: "Missed money",
        confidence: pricedSwaps >= 8 ? "Medium" : "Low",
        evidenceCount: missed.earlySells.length + missed.lateBuys.length,
        explanation: "A counterfactual based only on later observed swap prices inside the lookahead window.",
      },
    ],
  };

  const sample = Array.isArray(txs) && txs.length ? txs[0] : null;
  const sampleRec = sample && typeof sample === "object" ? (sample as Record<string, unknown>) : null;
  const sampleEvents =
    sampleRec?.events && typeof sampleRec.events === "object"
      ? (sampleRec.events as Record<string, unknown>)
      : null;

  return NextResponse.json({
    address,
    summary,
    profile,
    dataQuality,
    explainability,
    topTrades,
    worstTrades,
    missed: {
      soldEarlyTotal: missed.soldEarlyTotal,
      boughtLateTotal: missed.boughtLateTotal,
      earlySells: missed.earlySells,
      lateBuys: missed.lateBuys,
    },
    tips,
    meta: {
      source: "helius_enhanced",
      txFetched: Array.isArray(txs) ? txs.length : 0,
      pagesFetched: fetched.pages,
      supportsLimit: fetched.supportsLimit,
      supportsBefore: fetched.supportsBefore,
      swapsFetched: swaps.length,
      swapsDetected: windowedSwaps.length,
      pricedSwaps,
      unpricedSwaps,
      swapsFromEvents: swaps.filter((s) => s.source === "events.swap").length,
      swapsFromType: swaps.filter((s) => s.source === "type.SWAP").length,
      realizedSells: realizedSells.length,
      solPriceUsed: solPrice,
      jupiterPriceIdsRequested,
      jupiterPriceIdsResolved,
      jupiterEnrichedSwaps,
      ...warm,
      sampleTxKeys: sampleRec ? Object.keys(sampleRec) : [],
      sampleHasEventsSwap: !!sampleEvents?.swap,
      sampleType: sampleRec?.type || null,
      note:
        "Date ranges are enforced on reported trades. Earlier fetched buys may still seed FIFO cost basis. Missed money remains a heuristic based on later wallet swap prices.",
      analysisWindow: {
        requestedRange: range,
        days: range === "ALL" ? null : days,
        cutoffSec,
      },
    },
  });
}
