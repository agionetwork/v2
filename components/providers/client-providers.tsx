'use client'

import dynamic from 'next/dynamic'

const SolanaWalletProvider = dynamic(
  () => import('@/components/solana/wallet-provider'),
  { ssr: false }
)

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>
} 