"use client";

// Side-effect import — installs Buffer BigInt polyfills on globalThis.Buffer
// AND Uint8Array.prototype before any Cloak SDK code captures Buffer.
// Must run in the client bundle, hence imported here (a "use client" module).
import "@/lib/buffer-polyfill";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { rateLimitedStorage } from '@/lib/secure-storage';
import { getWallets } from '@wallet-standard/app';

// Wallets to look for, with substring matches against the Wallet Standard
// registry name AND every legacy window global location each wallet
// historically injects into. Polling both at once gives us the fastest
// possible "I see it" signal.
type WalletKind = 'phantom' | 'solflare' | 'backpack';

interface WalletLocator {
  /** Names we accept when scanning the Wallet Standard registry. */
  standardNames: string[];
  /** Sync probes against legacy window globals. Returns the wallet object
   *  if found, or null. Many wallets inject into more than one location
   *  to maintain back-compat — we check every known one. */
  legacy: () => any | null;
}

const WALLET_LOCATORS: Record<WalletKind, WalletLocator> = {
  phantom: {
    standardNames: ['phantom'],
    legacy: () => {
      const w = window as any;
      // Newer Phantom builds inject in `window.phantom.solana` first,
      // then mirror to `window.solana`. Older ones only set window.solana.
      if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
      if (w.solana?.isPhantom) return w.solana;
      return null;
    },
  },
  solflare: {
    standardNames: ['solflare'],
    legacy: () => {
      const w = window as any;
      if (w.solflare?.isSolflare) return w.solflare;
      if (w.solflare) return w.solflare;
      if (w.solana?.isSolflare) return w.solana;
      return null;
    },
  },
  backpack: {
    standardNames: ['backpack'],
    legacy: () => {
      const w = window as any;
      if (w.backpack?.isBackpack || w.backpack?.isXnft) return w.backpack;
      if (w.xnft?.solana) return w.xnft.solana;
      return null;
    },
  },
};

function findStandardWallet(kind: WalletKind): any | null {
  if (typeof window === 'undefined') return null;
  const { standardNames } = WALLET_LOCATORS[kind];
  try {
    const { get } = getWallets();
    return (
      get().find((w: any) => {
        const name = String(w?.name ?? '').toLowerCase();
        return standardNames.some((n) => name.includes(n));
      }) ?? null
    );
  } catch {
    return null;
  }
}

type DetectedWalletHandle =
  | { type: 'legacy'; wallet: any }
  | { type: 'standard'; wallet: any };

/**
 * Poll BOTH detection paths (legacy globals + Wallet Standard registry)
 * every 100 ms until one of them sees the wallet, or the timeout elapses.
 * Polling beats event-listening here because some wallets inject lazily
 * (after `document_idle` or even after a user-visible interaction) and we
 * have no reliable single signal to wait on.
 */
async function detectWallet(
  kind: WalletKind,
  timeoutMs = 3500,
): Promise<DetectedWalletHandle | null> {
  if (typeof window === 'undefined') return null;
  const { legacy } = WALLET_LOCATORS[kind];

  const tryOnce = (): DetectedWalletHandle | null => {
    const legacyHit = legacy();
    if (legacyHit) return { type: 'legacy', wallet: legacyHit };
    const standardHit = findStandardWallet(kind);
    if (standardHit) return { type: 'standard', wallet: standardHit };
    return null;
  };

  const immediate = tryOnce();
  if (immediate) return immediate;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 100));
    const hit = tryOnce();
    if (hit) return hit;
  }
  return null;
}

async function connectLegacy(legacyWallet: any): Promise<string | null> {
  try {
    if (legacyWallet.isConnected && legacyWallet.publicKey) {
      return legacyWallet.publicKey.toString();
    }
    const resp = await legacyWallet.connect();
    const pk = legacyWallet.publicKey ?? resp?.publicKey;
    if (!pk) return null;
    return typeof pk?.toString === 'function' ? pk.toString() : null;
  } catch {
    return null;
  }
}

async function connectStandardWallet(standardWallet: any): Promise<string | null> {
  try {
    const features = standardWallet.features ?? {};
    const connectFeature = features['standard:connect'];
    if (!connectFeature?.connect) return null;
    const res = await connectFeature.connect();
    const address = res?.accounts?.[0]?.address;
    return typeof address === 'string' && address.length > 0 ? address : null;
  } catch {
    return null;
  }
}

// Visibility helper: dumps full registry contents (names) and which
// legacy globals are present, so a "wallet not detected" report can be
// triaged from the user's devtools console.
function diagnoseDetection(kind: WalletKind): void {
  if (typeof window === 'undefined') return;
  try {
    const standardNames: string[] = (() => {
      try {
        return getWallets().get().map((w: any) => String(w?.name ?? ''));
      } catch { return []; }
    })();
    const w = window as any;
    console.debug('[agio][wallet] detection failed for', kind, {
      standardRegistry: standardNames,
      windowSolana: !!w.solana,
      windowSolanaIsPhantom: !!w.solana?.isPhantom,
      windowSolanaIsSolflare: !!w.solana?.isSolflare,
      windowPhantomSolana: !!w.phantom?.solana,
      windowSolflare: !!w.solflare,
      windowBackpack: !!w.backpack,
      windowXnft: !!w.xnft,
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

// Minimal shape we expose for auto-detected Wallet Standard wallets so
// the UI can render an icon + name button without leaking the standard
// internals into components.
export interface DetectedWallet {
  name: string;
  icon?: string;
}

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  provider: string | null;
  /** Any Wallet Standard wallet the browser exposes (MetaMask Snaps,
   *  Phantom, Solflare, Backpack, …). Updated live as wallets register. */
  detectedWallets: DetectedWallet[];
  /** Connect via the Wallet Standard registry by the wallet's name. */
  connectStandard: (walletName: string) => Promise<void>;
  connect: (provider: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  address: null,
  provider: null,
  detectedWallets: [],
  connectStandard: async () => {},
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
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([]);

  // Subscribe to the Wallet Standard registry so the modal can show
  // whatever wallets the user actually has (MetaMask Snaps Solana,
  // Phantom, Solflare, Backpack, …) and offer them with one click.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const refresh = () => {
      try {
        const { get } = getWallets();
        const list: DetectedWallet[] = get().map((w: any) => ({
          name: String(w?.name ?? ''),
          icon: typeof w?.icon === 'string' ? w.icon : undefined,
        }));
        if (!cancelled) setDetectedWallets(list);
      } catch { /* ignore */ }
    };
    refresh();
    let offReg: (() => void) | undefined;
    let offUnreg: (() => void) | undefined;
    try {
      const { on } = getWallets();
      offReg = on('register', refresh);
      offUnreg = on('unregister', refresh);
    } catch { /* ignore */ }
    // Periodic re-scan as a safety net for extensions that inject very
    // late (after `document_idle` + some interaction tick). Cheap.
    const interval = setInterval(refresh, 500);
    // Stop polling once we have something so we don't spam getWallets().
    const stopPolling = setTimeout(() => clearInterval(interval), 8000);
    return () => {
      cancelled = true;
      try { offReg?.(); } catch { /* ignore */ }
      try { offUnreg?.(); } catch { /* ignore */ }
      clearInterval(interval);
      clearTimeout(stopPolling);
    };
  }, []);

  // Generic Wallet Standard connect by the wallet's exact name.
  const connectStandard = async (walletName: string) => {
    try {
      if (typeof window === 'undefined') return;
      const { get } = getWallets();
      const target = get().find(
        (w: any) => String(w?.name ?? '').toLowerCase() === walletName.toLowerCase(),
      );
      if (!target) {
        throw new WalletNotFoundError(`${walletName} wallet is no longer available.`);
      }
      const connectFeature = (target as any).features?.['standard:connect'];
      if (!connectFeature?.connect) {
        throw new Error(`${walletName} does not support standard:connect.`);
      }
      const res = await connectFeature.connect();
      const publicKey = res?.accounts?.[0]?.address;
      if (!publicKey) {
        throw new Error(`${walletName} returned no account.`);
      }
      await rateLimitedStorage.setItem('walletAddress', publicKey);
      await rateLimitedStorage.setItem('walletProvider', `standard:${target.name}`);
      setAddress(publicKey);
      setProvider(`standard:${target.name}`);
      setIsConnected(true);
      try {
        fetch('/api/social-points/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: publicKey }),
        }).catch(() => {});
      } catch { /* ignore */ }
    } catch (error) {
      console.error('Error connecting wallet (standard):', error);
      if (error instanceof Error) throw error;
      throw new Error('Unknown wallet connection error');
    }
  };

  const connect = async (walletProvider: string) => {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      let publicKey: string = '';
      let storedProvider: string = walletProvider;

      // Poll BOTH paths (legacy globals + Wallet Standard registry) in
      // parallel for up to 3.5 s. Whichever sees the wallet first wins.
      // This is robust against extensions that inject late, register
      // under unusual names, or only ship one of the two interfaces.
      if (walletProvider !== 'phantom' && walletProvider !== 'solflare' && walletProvider !== 'backpack') {
        throw new Error('Unsupported wallet provider');
      }
      const kind: WalletKind = walletProvider;
      const detected = await detectWallet(kind);
      if (detected) {
        const pk = detected.type === 'legacy'
          ? await connectLegacy(detected.wallet)
          : await connectStandardWallet(detected.wallet);
        if (pk) {
          publicKey = pk;
          // If we connected through Wallet Standard, persist the actual
          // wallet name so disconnect routes back through standard.
          if (detected.type === 'standard') {
            storedProvider = `standard:${String(detected.wallet?.name ?? walletProvider)}`;
          }
        }
      }

      if (!publicKey) {
        diagnoseDetection(kind);
        const installUrls: Record<WalletKind, string> = {
          phantom: 'https://phantom.app/',
          solflare: 'https://solflare.com/',
          backpack: 'https://backpack.app/',
        };
        const label: Record<WalletKind, string> = {
          phantom: 'Phantom',
          solflare: 'Solflare',
          backpack: 'Backpack',
        };
        throw new WalletNotFoundError(
          `${label[kind]} wallet not found. Please install it from ${installUrls[kind]}`,
        );
      }

      // Store connection info securely
      await rateLimitedStorage.setItem('walletAddress', publicKey);
      await rateLimitedStorage.setItem('walletProvider', storedProvider);

      setAddress(publicKey);
      setProvider(storedProvider);
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
      if (provider && provider.startsWith('standard:')) {
        const walletName = provider.slice('standard:'.length);
        try {
          const { get } = getWallets();
          const target = get().find(
            (w: any) => String(w?.name ?? '').toLowerCase() === walletName.toLowerCase(),
          );
          const disconnectFeature = (target as any)?.features?.['standard:disconnect'];
          if (disconnectFeature?.disconnect) {
            await disconnectFeature.disconnect();
          }
        } catch { /* ignore */ }
      } else if (provider === 'phantom' && typeof (window as any).solana !== 'undefined') {
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
        detectedWallets,
        connectStandard,
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
