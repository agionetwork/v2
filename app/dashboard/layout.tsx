"use client"

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom"
import { useMemo, useState, useEffect } from "react"
import type { ReactNode } from "react"
import DashboardHeader from "../../components/dashboard/dashboard-header"
import { ErrorBoundary } from "../../components/error-boundary"
import { WalletSyncBridge } from "@/components/wallet-sync-bridge"
import { LoansProvider } from "@/components/loans-provider"
import { TapestryProfileProvider } from "@/components/tapestry-profile-provider"
import { FriendsProvider } from "@/components/friends-provider"
import { SOLANA_CONFIG } from "@/config/solana"

import "@solana/wallet-adapter-react-ui/styles.css"

// ErrorBoundary específico para WalletProvider que suprime erros de extensões
function WalletErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}

// Componente interno do WalletProvider que só renderiza no cliente
function WalletProviderContent({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => SOLANA_CONFIG.RPC_URL, [])
  
  const wallets = useMemo(() => {
    // Só criar wallets quando window estiver disponível
    if (typeof window === "undefined") return []
    
    try {
      // Suprimir erros temporariamente durante a criação do adapter
      const originalError = console.error
      const originalWarn = console.warn
      
      console.error = (...args: any[]) => {
        const firstArg = args[0]
        const message = typeof firstArg === 'string' ? firstArg : (firstArg?.message || firstArg?.toString() || '')
        const stack = firstArg?.stack || ''
        
        if (
          message.includes("Cannot destructure property 'register'") ||
          message.includes('register') ||
          message.includes('EIP-6963') ||
          stack.includes('chrome-extension://') ||
          stack.includes('solana.js') ||
          stack.includes('btc.js') ||
          stack.includes('sui.js') ||
          stack.includes('inpage.js') ||
          stack.includes('injected.js')
        ) {
          return // Silenciar
        }
        originalError.apply(console, args)
      }
      
      console.warn = (...args: any[]) => {
        const firstArg = args[0]
        const message = typeof firstArg === 'string' ? firstArg : (firstArg?.message || firstArg?.toString() || '')
        const stack = firstArg?.stack || ''
        
        if (
          message.includes("Cannot destructure property 'register'") ||
          message.includes('register') ||
          message.includes('EIP-6963') ||
          stack.includes('chrome-extension://') ||
          stack.includes('solana.js') ||
          stack.includes('btc.js') ||
          stack.includes('sui.js')
        ) {
          return // Silenciar
        }
        originalWarn.apply(console, args)
      }
      
      const wallet = new PhantomWalletAdapter()
      
      // Restaurar console original
      setTimeout(() => {
        console.error = originalError
        console.warn = originalWarn
      }, 100)
      
      return [wallet]
    } catch (error) {
      return []
    }
  }, [])

  // Suprimir erros de runtime durante a renderização
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const error = event.error
      if (!error) return
      
      const message = error.message || error.toString()
      const stack = error.stack || ''
      
      if (
        message.includes("Cannot destructure property 'register'") ||
        message.includes('register') ||
        stack.includes('chrome-extension://') ||
        stack.includes('solana.js') ||
        stack.includes('btc.js') ||
        stack.includes('sui.js') ||
        stack.includes('inpage.js') ||
        stack.includes('injected.js')
      ) {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    }
    
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      if (!reason) return
      
      const message = reason.message || reason.toString()
      const stack = reason.stack || ''
      
      if (
        message.includes("Cannot destructure property 'register'") ||
        message.includes('register') ||
        stack.includes('chrome-extension://') ||
        stack.includes('solana.js') ||
        stack.includes('btc.js') ||
        stack.includes('sui.js') ||
        stack.includes('inpage.js') ||
        stack.includes('injected.js')
      ) {
        event.preventDefault()
        return false
      }
    }
    
    window.addEventListener('error', handleError, true)
    window.addEventListener('unhandledrejection', handleRejection, true)
    
    return () => {
      window.removeEventListener('error', handleError, true)
      window.removeEventListener('unhandledrejection', handleRejection, true)
    }
  }, [])

  return (
    <WalletErrorBoundary>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider 
          wallets={wallets} 
          autoConnect={true}
          onError={(error) => {
            // Silenciar completamente TODOS os erros de extensões de carteira não suportadas
            // Esses erros são normais quando extensões de outras blockchains tentam se registrar
            // e não afetam a funcionalidade do Solana wallet adapter
            // Não fazer nada - silenciar completamente
            return
          }}
        >
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
    </WalletErrorBoundary>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Aguardar um pequeno delay para garantir que todas as extensões de carteira estejam inicializadas
    const timer = setTimeout(() => {
      setMounted(true)
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])

  // Aguardar montagem no cliente para evitar erros de SSR
  if (!mounted || typeof window === "undefined") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <WalletProviderContent>{children}</WalletProviderContent>
} 