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
  { symbol: "TRUMP", coingeckoId: "official-trump" },
  { symbol: "FARTCOIN", coingeckoId: "fartcoin" },
  { symbol: "PENGU", coingeckoId: "pudgy-penguins" },
  { symbol: "PNUT", coingeckoId: "peanut-the-squirrel" },
  { symbol: "GRASS", coingeckoId: "grass" },
  { symbol: "DRIFT", coingeckoId: "drift-protocol" },
  { symbol: "KMNO", coingeckoId: "kamino" },
  { symbol: "HNT", coingeckoId: "helium" },
  { symbol: "W", coingeckoId: "wormhole" },
  { symbol: "TNSR", coingeckoId: "tensor" },
];

export const coingeckoIdBySymbol = Object.fromEntries(
  TOKENS.map((token) => [token.symbol, token.coingeckoId])
) as Record<string, string>;

export const idMap = Object.fromEntries(
  TOKENS.map((token) => [token.symbol.toLowerCase(), token.coingeckoId])
) as Record<string, string>;
