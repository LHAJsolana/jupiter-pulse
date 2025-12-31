// 🔥 Global token ID map for CoinGecko + Shared Utilities

export const idMap: Record<string, string> = {
  sol: "solana",
  eth: "ethereum",
  btc: "bitcoin",
  bonk: "bonk",
  sui: "sui",
  apt: "aptos",
  // add more tokens later as needed
};


// 🏦 Fetch Market Data (Used in /api/market)
export async function fetchMarketData() {
  const ids = Object.values(idMap).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });

    const data = await res.json();

    return Object.keys(idMap).map((symbol) => ({
      symbol,
      price: data[idMap[symbol]]?.usd || 0,
      change24h: data[idMap[symbol]]?.usd_24h_change || 0,
    }));
  } catch (err) {
    console.log("🔥 Market fetch failed:", err);
    return [];
  }
}


// 📈 Fetch History Data (Used for charts in Pulse pages)
export async function fetchHistory(symbol: string, days: string = "7") {
  const id = idMap[symbol.toLowerCase()];
  if (!id) return null;

  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });

    const data = await res.json();
    return data?.prices ?? null;

  } catch (err) {
    console.log("🔥 History fetch error:", err);
    return null;
  }
}
