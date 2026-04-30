import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { SOLANA_CONFIG } from '@/config/solana';
import IDL from '@/lib/idl/agio.json';

export function createConnection(): Connection {
  return new Connection(SOLANA_CONFIG.RPC_URL, { commitment: 'confirmed' });
}

export function createProvider(
  connection: Connection,
  wallet: {
    publicKey: PublicKey;
    signTransaction: (tx: any) => Promise<any>;
    signAllTransactions: (txs: any[]) => Promise<any[]>;
  },
): AnchorProvider {
  return new AnchorProvider(connection, wallet as any, {
    commitment: 'confirmed',
    preflightCommitment: 'processed',
    skipPreflight: true,
    maxRetries: 5,
  });
}

export function createProgram(provider: AnchorProvider): Program {
  return new Program(IDL as unknown as Idl, provider);
}

export function createReadonlyProgram(connection: Connection): Program {
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };
  const provider = createProvider(connection, dummyWallet);
  return createProgram(provider);
}
