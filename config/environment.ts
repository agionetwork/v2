export const ENV_CONFIG = {
  SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID || 'AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX',
  EURC_MINT: process.env.NEXT_PUBLIC_EURC_MINT || 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_VERCEL: process.env.VERCEL === '1',
  VERCEL_ENV: process.env.VERCEL_ENV || 'development',
} as const;

export default ENV_CONFIG;
