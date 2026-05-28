"use client";

// Side-effect import — installs Buffer BigInt polyfills on globalThis.Buffer
// AND Uint8Array.prototype before any Cloak SDK code captures Buffer.
// Must run in the client bundle, hence imported here (a "use client" module).
import "@/lib/buffer-polyfill";

import { createContext, useContext, useState, ReactNode } from "react";
import { rateLimitedStorage } from '@/lib/secure-storage';
import { getWallets } from '@wallet-standard/app';

// Wallet Standard fallback: modern wallets (Phantom, Solflare, Backpack)
// register via the Wallet Standard registry. The legacy `window.solana`
// global is missing or unreliable when (a) multiple extensions are
// installed (whoever wins `window.solana` may not be the one the user
// clicked), or (b) a newer wallet build only ships the standard interface.
// We try the standard registry whenever legacy detection fails.
const STANDARD_NAME: Record<string, string[]> = {
  phantom: ['Phantom'],
  solflare: ['Solflare'],
  backpack: ['Backpack'],
};

async function tryStandardConnect(walletProvider: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const wanted = STANDARD_NAME[walletProvider];
    if (!wanted) return null;
    const { get } = getWallets();
    const candidate = get().find((w: { name: string }) =>
      wanted.some((n) => w.name.toLowerCase() === n.toLowerCase()),
    );
    if (!candidate) return null;
    const features = (candidate as any).features ?? {};
    const connectFeature = features['standard:connect'];
    if (!connectFeature?.connect) return null;
    const res = await connectFeature.connect();
    const address = res?.accounts?.[0]?.address;
    return typeof address === 'string' && address.length > 0 ? address : null;
  } catch {
    return null;
  }
}

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  provider: string | null;
  connect: (provider: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  address: null,
  provider: null,
  connect: async () => {},
  disconnect: async () => {},
});

// Read wallet state synchronously from sessionStorage to avoid flash of "Connect Wallet"
function getStoredWalletState() {
  if (typeof window === 'undefined') return { address: null, provider: null };
  try {
    const address = window.sessionStorage.getItem('agio_walletAddress');
    const provider = window.sessionStorage.getItem('agio_walletProvider');
    return { address, provider };
  } catch {
    return { address: null, provider: null };
  }
}

// Simple wallet provider - direct Solana wallet connections only
function WalletProviderInternal({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(() => {
    const s = getStoredWalletState();
    return !!(s.address && s.provider);
  });
  const [address, setAddress] = useState<string | null>(() => getStoredWalletState().address);
  const [provider, setProvider] = useState<string | null>(() => getStoredWalletState().provider);

  const connect = async (walletProvider: string) => {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      let wallet: any = null;
      let publicKey: string = '';

      switch (walletProvider) {
        case 'phantom':
          // Check for Phantom wallet (legacy global)
          if (typeof (window as any).solana !== 'undefined' && (window as any).solana.isPhantom) {
            wallet = (window as any).solana;

            // Check if already connected
            if (wallet.isConnected) {
              publicKey = wallet.publicKey.toString();
            } else {
              const phantomResp = await wallet.connect();
              publicKey = phantomResp.publicKey.toString();
            }
          } else {
            const fromStandard = await tryStandardConnect('phantom');
            if (fromStandard) {
              publicKey = fromStandard;
            } else {
              throw new Error('Phantom wallet not found. Please install Phantom wallet extension from https://phantom.app/');
            }
          }
          break;

        case 'solflare':
          // Check for Solflare wallet (legacy global)
          if (typeof (window as any).solflare !== 'undefined') {
            wallet = (window as any).solflare;

            if (wallet.isConnected) {
              publicKey = wallet.publicKey.toString();
            } else {
              const solflareResp = await wallet.connect();
              const pk = (wallet.publicKey || solflareResp?.publicKey);
              publicKey = typeof pk?.toString === 'function' ? pk.toString() : '';
            }
          } else if (typeof (window as any).solana !== 'undefined' && (window as any).solana.isSolflare) {
            wallet = (window as any).solana;

            if (wallet.isConnected) {
              publicKey = wallet.publicKey.toString();
            } else {
              const solflareResp = await wallet.connect();
              const pk = (wallet.publicKey || solflareResp?.publicKey);
              publicKey = typeof pk?.toString === 'function' ? pk.toString() : '';
            }
          } else {
            const fromStandard = await tryStandardConnect('solflare');
            if (fromStandard) {
              publicKey = fromStandard;
            } else {
              throw new Error('Solflare wallet not found. Please install Solflare wallet extension from https://solflare.com/');
            }
          }
          break;

        case 'backpack':
          // Check for Backpack wallet (legacy global)
          if (typeof (window as any).backpack !== 'undefined' && ((window as any).backpack.isBackpack || (window as any).backpack.isXnft)) {
            wallet = (window as any).backpack;

            if (wallet.isConnected) {
              publicKey = wallet.publicKey.toString();
            } else {
              const backpackResp = await wallet.connect();
              publicKey = backpackResp.publicKey.toString();
            }
          } else {
            const fromStandard = await tryStandardConnect('backpack');
            if (fromStandard) {
              publicKey = fromStandard;
            } else {
              throw new Error('Backpack wallet not found. Please install Backpack wallet extension from https://backpack.app/');
            }
          }
          break;

        default:
          throw new Error('Unsupported wallet provider');
      }

      if (!publicKey) {
        throw new Error('Could not retrieve wallet public key — please try again.');
      }

      // Store connection info securely
      await rateLimitedStorage.setItem('walletAddress', publicKey);
      await rateLimitedStorage.setItem('walletProvider', walletProvider);

      setAddress(publicKey);
      setProvider(walletProvider);
      setIsConnected(true);

      // Award the +10 social-point connect bonus on first connect (server-side
      // dedup via Redis SETNX, so retries are no-ops). Fire & forget; failure
      // here must never block the wallet connection itself.
      try {
        fetch('/api/social-points/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: publicKey }),
        }).catch(() => {});
      } catch { /* ignore */ }

    } catch (error) {
      console.error('Error connecting wallet:', error);
      // Ensure we throw a proper error object, not an event
      if (error instanceof Error) {
        throw error;
      } else if (typeof error === 'string') {
        throw new Error(error);
      } else {
        throw new Error('Unknown wallet connection error');
      }
    }
  };

  const disconnect = async () => {
    // Disconnect from wallet if possible
    try {
      if (provider === 'phantom' && typeof (window as any).solana !== 'undefined') {
        const wallet = (window as any).solana;
        if (wallet.isConnected) {
          await wallet.disconnect();
        }
      } else if (provider === 'solflare' && typeof (window as any).solflare !== 'undefined') {
        const wallet = (window as any).solflare;
        if (wallet.isConnected) {
          await wallet.disconnect();
        }
      } else if (provider === 'backpack' && typeof (window as any).backpack !== 'undefined') {
        const wallet = (window as any).backpack;
        if (wallet.isConnected) {
          await wallet.disconnect();
        }
      }
    } catch (error) {
      console.warn('Could not disconnect from wallet:', error);
    }

    // Clear secure storage
    if (typeof window !== 'undefined') {
      rateLimitedStorage.removeItem('walletAddress');
      rateLimitedStorage.removeItem('walletProvider');
    }

    // Reset state
    setAddress(null);
    setProvider(null);
    setIsConnected(false);
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        address,
        provider,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// Main provider - simplified without Privy
export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WalletProviderInternal>
      {children}
    </WalletProviderInternal>
  );
}

export const useWalletContext = () => useContext(WalletContext);
