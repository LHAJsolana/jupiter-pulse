"use client";

import { useEffect, useState } from "react";

export function usePulse() {
  const [prices, setPrices] = useState({
    SOL: 98.12,
    JUP: 0.73,
    BONK: 0.000012,
    WIF: 2.14,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices((prev) => ({
        SOL: +(prev.SOL + (Math.random() - 0.5) * 0.2).toFixed(2),
        JUP: +(prev.JUP + (Math.random() - 0.5) * 0.01).toFixed(3),
        BONK: +(prev.BONK + (Math.random() - 0.5) * 0.0000002).toFixed(7),
        WIF: +(prev.WIF + (Math.random() - 0.5) * 0.05).toFixed(2),
      }));
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return {
    prices,
    loading: false,
    source: "mock-live",
  };
}
