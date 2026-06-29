export type TokenMeta = {
  symbol: string;
  coingeckoId: string;
};

export const TOKENS: TokenMeta[] = [
  { symbol: "SOL", coingeckoId: "solana" },
  { symbol: "JUP", coingeckoId: "jupiter-exchange-solana" },
  { symbol: "WIF", coingeckoId: "dogwifcoin" },
  { symbol: "BONK", coingeckoId: "bonk" },
  { symbol: "RAY", coingeckoId: "raydium" },
  { symbol: "ORCA", coingeckoId: "orca" },
  { symbol: "PYTH", coingeckoId: "pyth-network" },
  { symbol: "JTO", coingeckoId: "jito-governance-token" },
  { symbol: "RENDER", coingeckoId: "render-token" },
  { symbol: "BOME", coingeckoId: "book-of-meme" },
  { symbol: "MEW", coingeckoId: "cat-in-a-dogs-world" },
  { symbol: "POPCAT", coingeckoId: "popcat" },
  { symbol: "USDC", coingeckoId: "usd-coin" },
  { symbol: "USDT", coingeckoId: "tether" },
  { symbol: "BTC", coingeckoId: "bitcoin" },
  { symbol: "ETH", coingeckoId: "ethereum" },
  { symbol: "SUI", coingeckoId: "sui" },
  { symbol: "APT", coingeckoId: "aptos" },
];

export const coingeckoIdBySymbol = Object.fromEntries(
  TOKENS.map((token) => [token.symbol, token.coingeckoId])
) as Record<string, string>;

export const idMap = Object.fromEntries(
  TOKENS.map((token) => [token.symbol.toLowerCase(), token.coingeckoId])
) as Record<string, string>;
