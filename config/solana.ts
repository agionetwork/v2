import { clusterApiUrl, PublicKey } from '@solana/web3.js';

export const SOLANA_CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet') as 'devnet' | 'testnet' | 'mainnet-beta';

export const SOLANA_CONFIG = {
    RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(SOLANA_CLUSTER),
    PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID || 'AbvKH8U9B5y8HFNdAbErDo8nsFhFLHRk32HLzPD4GeXX',
    LOAN_SEED: 'loan',
    VAULT_AUTHORITY_SEED: 'vault_authority',
} as const;

export const PROGRAM_ID = new PublicKey(SOLANA_CONFIG.PROGRAM_ID);

/** Solscan URL suffix for the current cluster (empty on mainnet) */
export function solscanClusterParam(): string {
    if (SOLANA_CLUSTER === 'mainnet-beta') return '';
    return `?cluster=${SOLANA_CLUSTER}`;
}
