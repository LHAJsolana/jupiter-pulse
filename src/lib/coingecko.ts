// src/lib/coingecko.ts

/**
 * Map Solana token MINT → CoinGecko coin ID
 * Required for candles / OHLC
 */
export const COINGECKO_ID_BY_MINT: Record<string, string> = {
  // SOL
  "So11111111111111111111111111111111111111112": "solana",

  // JUP
  // replace mint if different in your data
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "jupiter-exchange-solana",

  // USDC (not needed for candles, but safe)
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "usd-coin",

  // USDT
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "tether",
};
