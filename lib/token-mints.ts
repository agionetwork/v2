import { PublicKey, Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

// Devnet token mint addresses
export const TOKEN_MINTS: Record<string, PublicKey> = {
  USDC: new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  EURC: new PublicKey('HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr'),
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
};

// Token program for each mint (EURC uses Token-2022, others use SPL Token)
export const TOKEN_PROGRAMS: Record<string, PublicKey> = {
  USDC: TOKEN_PROGRAM_ID,
  EURC: TOKEN_2022_PROGRAM_ID,
  SOL: TOKEN_PROGRAM_ID,
};

export function getTokenProgram(symbol: string): PublicKey {
  return TOKEN_PROGRAMS[symbol] ?? TOKEN_PROGRAM_ID;
}

export function getTokenProgramForMint(mint: PublicKey): PublicKey {
  for (const [sym, m] of Object.entries(TOKEN_MINTS)) {
    if (m.equals(mint)) return TOKEN_PROGRAMS[sym] ?? TOKEN_PROGRAM_ID;
  }
  return TOKEN_PROGRAM_ID;
}

export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  EURC: 6,
  SOL: 9,
};

export function getTokenMint(symbol: string): PublicKey {
  const mint = TOKEN_MINTS[symbol];
  if (!mint) throw new Error(`Unknown token: ${symbol}`);
  return mint;
}

export function getTokenDecimals(symbol: string): number {
  return TOKEN_DECIMALS[symbol] ?? 9;
}

/** Round a UI amount to the token's decimal precision to avoid floating-point artifacts */
export function roundUi(amount: number, symbol: string): number {
  const decimals = TOKEN_DECIMALS[symbol] ?? 9;
  const factor = 10 ** decimals;
  return Math.round(amount * factor) / factor;
}

/**
 * Query the on-chain mint account to determine the actual token program
 * (TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID). Results are cached for the
 * lifetime of the process — mint ownership never changes.
 */
const mintProgramCache = new Map<string, PublicKey>();

export async function resolveTokenProgram(
  connection: Connection,
  mint: PublicKey,
): Promise<PublicKey> {
  const key = mint.toBase58();
  const cached = mintProgramCache.get(key);
  if (cached) return cached;

  const info = await connection.getAccountInfo(mint);
  if (!info) {
    // Mint not found on-chain — fall back to static config
    const fallback = getTokenProgramForMint(mint);
    mintProgramCache.set(key, fallback);
    return fallback;
  }

  const program = info.owner;
  mintProgramCache.set(key, program);
  return program;
}
