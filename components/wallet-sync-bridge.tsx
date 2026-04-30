"use client"

import { useEffect } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletContext } from "@/components/wallet-provider"

/**
 * Bridge component that syncs the custom WalletProvider (used by the header UI)
 * with the Solana wallet-adapter-react WalletProvider (used by useLoanContract).
 *
 * Must be rendered inside BOTH providers.
 * When the custom provider detects a connected wallet, this component
 * programmatically selects and connects the same wallet in the Solana adapter.
 */
export function WalletSyncBridge() {
  const { isConnected: customConnected, provider: customProvider } = useWalletContext()
  const { select, connect, connected: adapterConnected, wallets } = useWallet()

  useEffect(() => {
    if (customConnected && !adapterConnected && customProvider) {
      // Map custom provider name to Solana adapter wallet name
      const adapterNameMap: Record<string, string> = {
        phantom: "Phantom",
        solflare: "Solflare",
        backpack: "Backpack",
      }

      const adapterName = adapterNameMap[customProvider]
      if (!adapterName) return

      // Find the matching wallet adapter
      const matchingWallet = wallets.find(
        (w) => w.adapter.name === adapterName
      )

      if (matchingWallet) {
        try {
          select(matchingWallet.adapter.name as any)
          // connect() is called automatically after select when autoConnect is true,
          // but we call it explicitly to be sure
          setTimeout(() => {
            connect().catch(() => {
              // Silent - autoConnect may handle it
            })
          }, 100)
        } catch {
          // Silent catch - the wallet may connect via autoConnect
        }
      }
    }
  }, [customConnected, adapterConnected, customProvider, select, connect, wallets])

  return null
}
