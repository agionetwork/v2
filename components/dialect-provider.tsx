"use client"

import { createContext, useContext, useMemo } from "react"
import { PublicKey } from "@solana/web3.js"
import { ConnectionProvider, WalletProvider as WalletAdapterProvider } from "@solana/wallet-adapter-react"
import { DialectSolanaSdk, type DialectSolanaWalletAdapter } from "@dialectlabs/react-sdk-blockchain-solana"
import "@dialectlabs/react-ui/index.css"
import "@/components/dialect-theme.css"
import { useWalletContext } from "@/components/wallet-provider"
import { DialectAutoSubscribe } from "@/components/dialect-auto-subscribe"

const DAPP_ADDRESS = process.env.NEXT_PUBLIC_DIALECT_DAPP_ADDRESS || ""
const DIALECT_CLIENT_KEY = process.env.NEXT_PUBLIC_DIALECT_CLIENT_KEY || ""
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
const EMPTY_WALLETS: never[] = []

const DialectContext = createContext(false)

export function useDialectAvailable() {
  return useContext(DialectContext)
}

/**
 * Minimal @solana/wallet-adapter-react providers.
 * DialectSolanaSdk internally calls useWallet() which requires these.
 * Our app uses a custom wallet provider, so these are empty shells.
 * Must be placed above DialectNotificationProvider in the component tree.
 */
export function SolanaAdapterShell({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletAdapterProvider wallets={EMPTY_WALLETS} autoConnect={false}>
        {children}
      </WalletAdapterProvider>
    </ConnectionProvider>
  )
}

function getWalletObject(provider: string | null): any {
  if (typeof window === "undefined" || !provider) return null
  switch (provider) {
    case "phantom":
      return (window as any).solana?.isPhantom ? (window as any).solana : null
    case "solflare":
      return (window as any).solflare || ((window as any).solana?.isSolflare ? (window as any).solana : null)
    case "backpack":
      return (window as any).backpack || null
    default:
      return null
  }
}

export function DialectNotificationProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, address, provider } = useWalletContext()

  const walletAdapter: DialectSolanaWalletAdapter | undefined = useMemo(() => {
    if (!isConnected || !address) return undefined
    const wallet = getWalletObject(provider)
    if (!wallet) return undefined

    return {
      publicKey: new PublicKey(address),
      signMessage: async (msg: Uint8Array): Promise<Uint8Array> => {
        const result = await wallet.signMessage(msg, "utf8")
        return result.signature || result
      },
      signTransaction: async <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(tx: T): Promise<T> => {
        return wallet.signTransaction(tx)
      },
    }
  }, [isConnected, address, provider])

  // No DAPP_ADDRESS configured — skip Dialect entirely
  if (!DAPP_ADDRESS) {
    return (
      <DialectContext.Provider value={false}>
        {children}
      </DialectContext.Provider>
    )
  }

  // Wallet not connected — don't mount SDK (avoids timing issues where
  // the SDK's internal `sdk` instance stays null because walletConnected
  // and blockchainSdkFactory don't sync on late wallet connection).
  if (!isConnected || !walletAdapter) {
    return (
      <DialectContext.Provider value={false}>
        {children}
      </DialectContext.Provider>
    )
  }

  // key={address} forces a full unmount/remount when wallet connects or changes,
  // ensuring the SDK initializes from scratch with valid factory + walletConnected.
  return (
    <DialectContext.Provider value={true}>
      <DialectSolanaSdk
        key={address}
        dappAddress={DAPP_ADDRESS}
        config={{
          environment: "production",
          dialectCloud: {
            tokenStore: "local-storage",
            tokenLifetimeMinutes: 43200,
            clientKey: DIALECT_CLIENT_KEY || undefined,
          },
        }}
        customWalletAdapter={walletAdapter}
      >
        <DialectAutoSubscribe />
        {children}
      </DialectSolanaSdk>
    </DialectContext.Provider>
  )
}
