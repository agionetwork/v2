'use client'

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { useMemo } from 'react'
import { SOLANA_CONFIG } from '@/config/solana'

export default function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => SOLANA_CONFIG.RPC_URL, [])

  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets as any} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
