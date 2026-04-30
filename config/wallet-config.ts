import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
import { clusterApiUrl } from "@solana/web3.js"

// Type definitions for wallets
interface WalletConfig {
  name: string
  icon: string
  url: string
  adapterName: string
}

interface SolanaConfig {
  network: WalletAdapterNetwork
  endpoint: string
  autoConnect: boolean
}

// Wallet configurations
export const WALLET_CONFIGS: Record<string, WalletConfig> = {
  // Phantom
  phantom: {
    name: "Phantom",
    icon: "/images/wallets/phantom.svg",
    url: "https://phantom.app/",
    adapterName: "PhantomWalletAdapter"
  },
  
  // Solflare
  solflare: {
    name: "Solflare",
    icon: "/images/wallets/solflare.png",
    url: "https://solflare.com/",
    adapterName: "SolflareWalletAdapter"
  },
  
  // Backpack
  backpack: {
    name: "Backpack",
    icon: "/images/wallets/backpack.png",
    url: "https://www.backpack.app/",
    adapterName: "BackpackWalletAdapter"
  }
}

// Solana network configuration
export const SOLANA_CONFIG: SolanaConfig = {
  network: WalletAdapterNetwork.Devnet,
  endpoint: clusterApiUrl(WalletAdapterNetwork.Devnet),
  autoConnect: true
}
