"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { rateLimitedStorage } from '@/lib/secure-storage';

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
          // Check for Phantom wallet
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
            throw new Error('Phantom wallet not found. Please install Phantom wallet extension from https://phantom.app/');
          }
          break;

        case 'solflare':
          // Check for Solflare wallet
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
            throw new Error('Solflare wallet not found. Please install Solflare wallet extension from https://solflare.com/');
          }
          break;

        case 'backpack':
          // Check for Backpack wallet
          if (typeof (window as any).backpack !== 'undefined' && ((window as any).backpack.isBackpack || (window as any).backpack.isXnft)) {
            wallet = (window as any).backpack;

            if (wallet.isConnected) {
              publicKey = wallet.publicKey.toString();
            } else {
              const backpackResp = await wallet.connect();
              publicKey = backpackResp.publicKey.toString();
            }
          } else {
            throw new Error('Backpack wallet not found. Please install Backpack wallet extension from https://backpack.app/');
          }
          break;

        default:
          throw new Error('Unsupported wallet provider');
      }

      // Store connection info securely
      await rateLimitedStorage.setItem('walletAddress', publicKey);
      await rateLimitedStorage.setItem('walletProvider', walletProvider);

      setAddress(publicKey);
      setProvider(walletProvider);
      setIsConnected(true);

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
