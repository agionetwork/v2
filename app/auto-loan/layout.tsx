"use client"

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom"
import { useMemo, useState, useEffect } from "react"
import type { ReactNode } from "react"
import DashboardHeader from "@/components/dashboard/dashboard-header"
import { ErrorBoundary } from "@/components/error-boundary"
import { WalletSyncBridge } from "@/components/wallet-sync-bridge"
import { TapestryProfileProvider } from "@/components/tapestry-profile-provider"
import { FriendsProvider } from "@/components/friends-provider"
import { LoansProvider } from "@/components/loans-provider"
import { SOLANA_CONFIG } from "@/config/solana"

import "@solana/wallet-adapter-react-ui/styles.css"

function AutoLoanContent({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => SOLANA_CONFIG.RPC_URL, [])

  const wallets = useMemo(() => {
    if (typeof window === "undefined") return []
    try {
      return [new PhantomWalletAdapter()]
    } catch {
      return []
    }
  }, [])

  return (
    <ErrorBoundary>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect onError={() => {}}>
          <WalletSyncBridge />
          <LoansProvider>
            <TapestryProfileProvider>
              <FriendsProvider>
                <DashboardHeader />
                <div className="agio-glass-page">{children}</div>
              </FriendsProvider>
            </TapestryProfileProvider>
          </LoansProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ErrorBoundary>
  )
}

export default function AutoLoanLayout({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  if (!mounted || typeof window === "undefined") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <AutoLoanContent>{children}</AutoLoanContent>
}
