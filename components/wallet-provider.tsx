"use client";

// Side-effect import — installs Buffer BigInt polyfills on globalThis.Buffer
// AND Uint8Array.prototype before any Cloak SDK code captures Buffer.
// Must run in the client bundle, hence imported here (a "use client" module).
import "@/lib/buffer-polyfill";

import { createContext, useContext, useState, ReactNode } from "react";
import { rateLimitedStorage } from '@/lib/secure-storage';
import { getWallets } from '@wallet-standard/app';

// Wallet Standard detection: modern wallets (Phantom, Solflare, Backpack)
// register via window events (`wallet-standard:register-wallet`). The
// legacy `window.solana` global is unreliable when (a) multiple
// extensions are installed (whoever wins `window.solana` may not be the
// one the user clicked), or (b) a newer build skips the legacy global
// in favour of a dedicated namespace like `window.phantom.solana`.
// We prefer the standard registry and use legacy only as a fallback.
const STANDARD_NAME: Record<string, string[]> = {
  phantom: ['phantom'],
  solflare: ['solflare'],
  backpack: ['backpack'],
};

// Some wallets only register on the `wallet-standard:app-ready` window
// event. We dispatch it once at module load AND on each attempt so a
// late-loading extension still sees a fresh ready signal.
function pokeAppReady(): void {
  if (typeof window === 'undefined') return;
  try {
    // The spec event is `wallet-standard:app-ready`; wallets dispatch
    // `wallet-standard:register-wallet` in response. `getWallets()` from
    // `@wallet-standard/app` wires the listener; importing it is enough
    // — but we also dispatch the event directly in case the registry
    // initialised before any wallet got to inject.
    window.dispatchEvent(new Event('wallet-standard:app-ready'));
  } catch { /* ignore */ }
}

// Initialise the registry as soon as this module loads so the
// `app-ready` signal fires before the user clicks anything.
if (typeof window !== 'undefined') {
  try { getWallets(); pokeAppReady(); } catch { /* ignore */ }
}

function findStandardWallet(walletProvider: string): any | null {
  if (typeof window === 'undefined') return null;
  const wanted = STANDARD_NAME[walletProvider];
  if (!wanted) return null;
  try {
    const { get } = getWallets();
    return (
      get().find((w: any) => {
        const name = String(w?.name ?? '').toLowerCase();
        return wanted.some((n) => name.includes(n));
      }) ?? null
    );
  } catch {
    return null;
  }
}

// Wait for the wallet to register itself (race on click before the
// extension's `wallet-standard:register-wallet` event fired). Re-pokes
// `app-ready` once mid-wait in case the wallet missed the initial one.
async function waitForStandardWallet(
  walletProvider: string,
  timeoutMs = 2000,
): Promise<any | null> {
  pokeAppReady();
  const found = findStandardWallet(walletProvider);
  if (found) return found;
  return new Promise<any | null>((resolve) => {
    let settled = false;
    const finish = (val: any | null) => {
      if (settled) return;
      settled = true;
      try { off?.(); } catch { /* ignore */ }
      resolve(val);
    };
    let off: (() => void) | undefined;
    try {
      const { on } = getWallets();
      off = on('register', () => {
        const w = findStandardWallet(walletProvider);
        if (w) finish(w);
      });
    } catch { /* ignore */ }
    setTimeout(() => { pokeAppReady(); }, Math.min(400, timeoutMs / 2));
    setTimeout(() => finish(findStandardWallet(walletProvider)), timeoutMs);
  });
}

async function tryStandardConnect(walletProvider: string): Promise<string | null> {
  const candidate = await waitForStandardWallet(walletProvider);
  if (!candidate) return null;
  try {
    const features = candidate.features ?? {};
    const connectFeature = features['standard:connect'];
    if (!connectFeature?.connect) return null;
    const res = await connectFeature.connect();
    const address = res?.accounts?.[0]?.address;
    return typeof address === 'string' && address.length > 0 ? address : null;
  } catch {
    return null;
  }
}

// Visibility helper: dumps everything we tried in console.debug so the
// "wallet not detected" path is debuggable from devtools without ever
// surfacing addresses or sensitive data.
function diagnoseDetection(walletProvider: string): void {
  if (typeof window === 'undefined') return;
  try {
    const { get } = getWallets();
    const standardNames = get().map((w: any) => String(w?.name ?? ''));
    const w = window as any;
    console.debug('[agio][wallet] detection failed for', walletProvider, {
      standardRegistry: standardNames,
      windowSolana: !!w.solana,
      windowSolanaIsPhantom: !!w.solana?.isPhantom,
      windowPhantomSolana: !!w.phantom?.solana,
      windowSolflare: !!w.solflare,
      windowBackpack: !!w.backpack,
    });
  } catch (e) {
    console.debug('[agio][wallet] diagnose error', e);
  }
}

// Structured error so the UI can tell "wallet missing" apart from other
// failures whose message happens to contain "not found".
class WalletNotFoundError extends Error {
  code = 'WALLET_NOT_FOUND' as const;
  constructor(message: string) { super(message); this.name = 'WalletNotFoundError'; }
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

      // Try Wallet Standard first (more reliable across builds + survives
      // window.solana hijacking by other extensions). Fall back to legacy
      // globals only if no standard wallet registers in time.
      const fromStandard = await tryStandardConnect(walletProvider);
      if (fromStandard) {
        publicKey = fromStandard;
      } else {
        switch (walletProvider) {
          case 'phantom': {
            // Phantom injects in BOTH `window.solana` (legacy) and
            // `window.phantom.solana` (dedicated namespace). Newer
            // builds may only ship the dedicated one.
            const w = window as any;
            const phantomLegacy = w.solana?.isPhantom ? w.solana : null;
            const phantomNamespace = w.phantom?.solana?.isPhantom ? w.phantom.solana : null;
            wallet = phantomLegacy ?? phantomNamespace;
            if (wallet) {
              if (wallet.isConnected) {
                publicKey = wallet.publicKey.toString();
              } else {
                const phantomResp = await wallet.connect();
                publicKey = phantomResp.publicKey.toString();
              }
            } else {
              diagnoseDetection('phantom');
              throw new WalletNotFoundError('Phantom wallet not found. Please install Phantom wallet extension from https://phantom.app/');
            }
            break;
          }

          case 'solflare':
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
              diagnoseDetection('solflare');
              throw new WalletNotFoundError('Solflare wallet not found. Please install Solflare wallet extension from https://solflare.com/');
            }
            break;

          case 'backpack':
            if (typeof (window as any).backpack !== 'undefined' && ((window as any).backpack.isBackpack || (window as any).backpack.isXnft)) {
              wallet = (window as any).backpack;
              if (wallet.isConnected) {
                publicKey = wallet.publicKey.toString();
              } else {
                const backpackResp = await wallet.connect();
                publicKey = backpackResp.publicKey.toString();
              }
            } else {
              diagnoseDetection('backpack');
              throw new WalletNotFoundError('Backpack wallet not found. Please install Backpack wallet extension from https://backpack.app/');
            }
            break;

          default:
            throw new Error('Unsupported wallet provider');
        }
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
