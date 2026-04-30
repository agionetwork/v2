"use client"

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom"
import { useMemo, useState, useEffect } from "react"
import DashboardHeader from "../../components/dashboard/dashboard-header"
import { WalletSyncBridge } from "@/components/wallet-sync-bridge"
import { LoansProvider } from "@/components/loans-provider"
import { TapestryProfileProvider } from "@/components/tapestry-profile-provider"
import { FriendsProvider } from "@/components/friends-provider"
import { SOLANA_CONFIG } from "@/config/solana"

import "@solana/wallet-adapter-react-ui/styles.css"

export default function BorrowLendLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const endpoint = useMemo(() => SOLANA_CONFIG.RPC_URL, [])

  const wallets = useMemo(() => {
    if (typeof window === "undefined") return []
    try {
      return [new PhantomWalletAdapter()]
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={() => {}}>
        <WalletSyncBridge />
        <LoansProvider>
          <TapestryProfileProvider>
            <FriendsProvider>
              <div className="h-dvh overflow-hidden flex flex-col">
                <DashboardHeader />
                <div className="flex-1 overflow-hidden container mx-auto p-6">
                  {children}
                </div>
              </div>
            </FriendsProvider>
          </TapestryProfileProvider>
        </LoansProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
