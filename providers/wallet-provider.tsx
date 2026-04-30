"use client"

import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { useMemo, useState, useEffect } from "react"
import { SOLANA_CONFIG } from "@/config/solana"

import "@solana/wallet-adapter-react-ui/styles.css"

export function WalletProviderWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const endpoint = useMemo(() => SOLANA_CONFIG.RPC_URL, [])
  const wallets = useMemo(() => {
    if (typeof window === "undefined") return []
    return [new PhantomWalletAdapter()]
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
