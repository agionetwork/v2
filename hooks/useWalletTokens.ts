"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Connection, PublicKey } from "@solana/web3.js"
import { useTokenPrices } from "./useTokenPrices"
import { SOLANA_CONFIG } from "@/config/solana"
import { useWalletContext } from "@/components/wallet-provider"
import { useWallet } from "@solana/wallet-adapter-react"

// Definir tipos localmente
interface TokenBalance {
  symbol: string
  balance: number
  usdValue: number
  percentOfTotal: number
  decimals: number
  mint?: string
}

// Mapeamento de tokens conhecidos (mainnet + devnet) e EURC via env
const TOKEN_SYMBOLS: { [key: string]: string } = {
  // SOL
  "So11111111111111111111111111111111111111112": "SOL",
  // USDC mainnet
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
  // USDC devnet (Circle official devnet mint)
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": "USDC",
  // USDT mainnet
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "USDT",
  // EURC (Circle Euro Coin)
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr": "EURC",
  // BONK
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
  // JUP
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
}

// Adicionar EURC via variável de ambiente opcional
const EURC_MINT = process.env.NEXT_PUBLIC_EURC_MINT || ""
if (EURC_MINT && /^[1-9A-HJ-NP-Za-km-z]+$/.test(EURC_MINT)) {
  TOKEN_SYMBOLS[EURC_MINT] = "EURC"
}

const TOKEN_DECIMALS: { [key: string]: number } = {
  // SOL
  "So11111111111111111111111111111111111111112": 9,
  // USDC mainnet
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 6,
  // USDC devnet
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": 6,
  // USDT mainnet
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": 6,
  // EURC (Circle Euro Coin)
  "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr": 6,
  // BONK
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": 5,
  // JUP
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": 6,
}

if (EURC_MINT && /^[1-9A-HJ-NP-Za-km-z]+$/.test(EURC_MINT)) {
  TOKEN_DECIMALS[EURC_MINT] = 6
}

// Token Program ID como constante
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")

export function useWalletTokens() {
  // Always call hooks (React rule)
  // useWallet may return default values if not in context
  const solanaWalletData = useWallet()
  const walletContext = useWalletContext()

  // Prioritize Solana wallet adapter if connected and has publicKey, otherwise use wallet context
  const walletAddress = (solanaWalletData?.publicKey && solanaWalletData.connected)
    ? solanaWalletData.publicKey.toString()
    : walletContext.address
  const isWalletConnected = (solanaWalletData?.connected && !!solanaWalletData?.publicKey) || walletContext.isConnected

  const connection = useMemo(() => new Connection(SOLANA_CONFIG.RPC_URL, { commitment: "confirmed" }), [])
  const { prices } = useTokenPrices()
  const pricesRef = useRef(prices)
  pricesRef.current = prices
  const [isLoading, setIsLoading] = useState(false)
  const [tokens, setTokens] = useState<TokenBalance[]>([])
  const [error, setError] = useState<string | null>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hasLoadedRef = useRef(false)

  const isValidSolAddress = (addr?: string | null) => {
    if (!addr) return false
    try {
      return addr.length >= 32 && addr.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr)
    } catch {
      return false
    }
  }

  useEffect(() => {
    async function getTokenBalances() {
      await new Promise(resolve => setTimeout(resolve, 1000))
      let walletPublicKey: PublicKey | null = null

      // Try to use Solana wallet adapter first
      if (solanaWalletData?.publicKey) {
        walletPublicKey = solanaWalletData.publicKey
      } else if (isValidSolAddress(walletAddress) && isWalletConnected) {
        try {
          walletPublicKey = new PublicKey(walletAddress!)
        } catch (err) {
          console.error("Invalid wallet address:", err)
          walletPublicKey = null
        }
      }

      if (!walletPublicKey) {
        setTokens([])
        setError(null)
        setIsLoading(false)
        hasLoadedRef.current = false
        return
      }
      // Only show loading spinner on initial load, not on refreshes
      if (!hasLoadedRef.current) {
        setIsLoading(true)
      }
      setError(null)

      try {
        const walletTokens: TokenBalance[] = []

        // 1. Obter o saldo de SOL
        try {
          const solBalance = await connection.getBalance(walletPublicKey)
          const solBalanceInSol = solBalance / 1000000000

          if (solBalanceInSol > 0) {
            const solPrice = pricesRef.current.SOL?.price || 100
            const solUsdValue = solBalanceInSol * solPrice
            walletTokens.push({
              symbol: "SOL",
              balance: solBalanceInSol,
              usdValue: solUsdValue,
              percentOfTotal: 0,
              decimals: 9
            })
          }
        } catch (solError: any) {
          console.error("Error getting SOL balance:", solError)
          if (
            solError?.message?.includes('403') ||
            solError?.message?.includes('Access forbidden') ||
            solError?.message?.includes('Failed to fetch') ||
            solError?.name === 'TypeError'
          ) {
            setError("RPC connection error. Unable to fetch wallet balance.")
          }
        }

        // 2. Get SPL tokens from wallet
        try {
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
            programId: TOKEN_PROGRAM_ID,
          })

          for (const tokenAccount of tokenAccounts.value) {
            try {
              const parsedInfo = tokenAccount.account.data.parsed?.info
              if (!parsedInfo) continue

              const mintAddress = parsedInfo.mint
              const tokenAmount = parsedInfo.tokenAmount

              if (!mintAddress || !tokenAmount) continue

              const symbol = TOKEN_SYMBOLS[mintAddress]

              if (symbol && tokenAmount.uiAmount && tokenAmount.uiAmount > 0) {
                const balance = tokenAmount.uiAmount
                const decimals = tokenAmount.decimals || TOKEN_DECIMALS[mintAddress] || 0
                const price = pricesRef.current[symbol]?.price || 0
                const usdValue = balance * price

                walletTokens.push({
                  symbol,
                  balance,
                  usdValue,
                  percentOfTotal: 0,
                  mint: mintAddress,
                  decimals
                })
              }
            } catch (err) {
              console.warn("Error processing parsed token account:", err)
              continue
            }
          }

          // Fallback: also try old method in case parsed doesn't work
          if (walletTokens.length === 0 || walletTokens.filter(t => t.symbol === "SOL").length === walletTokens.length) {
            try {
              const rawTokenAccounts = await connection.getTokenAccountsByOwner(walletPublicKey, {
                programId: TOKEN_PROGRAM_ID,
              })

              for (const tokenAccount of rawTokenAccounts.value) {
                try {
                  const accountInfo = await connection.getAccountInfo(tokenAccount.pubkey)
                  if (accountInfo && accountInfo.data) {
                    const data = accountInfo.data
                    if (data.length >= 64) {
                      const mintBytes = data.slice(0, 32)
                      const mintAddress = new PublicKey(mintBytes).toString()

                      const symbol = TOKEN_SYMBOLS[mintAddress]

                      if (symbol) {
                        const amountBytes = data.slice(64, 72)
                        const amount = Buffer.from(amountBytes).readBigUInt64LE(0)

                        if (amount > BigInt(0)) {
                          const decimals = TOKEN_DECIMALS[mintAddress] || 0
                          const balance = Number(amount) / Math.pow(10, decimals)
                          const price = pricesRef.current[symbol]?.price || 0
                          const usdValue = balance * price

                          if (!walletTokens.find(t => t.symbol === symbol && t.mint === mintAddress)) {
                            walletTokens.push({
                              symbol,
                              balance,
                              usdValue,
                              percentOfTotal: 0,
                              mint: mintAddress,
                              decimals
                            })
                          }
                        }
                      }
                    }
                  }
                } catch (err) {
                  console.warn("Error processing raw token account:", err)
                  continue
                }
              }
            } catch (fallbackError) {
              console.warn("Fallback token parsing failed:", fallbackError)
            }
          }
        } catch (tokenError: any) {
          console.error("Error getting token accounts:", tokenError)
          if (
            tokenError?.message?.includes('403') ||
            tokenError?.message?.includes('Access forbidden') ||
            tokenError?.message?.includes('Failed to fetch') ||
            tokenError?.name === 'TypeError'
          ) {
            setError("RPC connection error. Unable to fetch token balances.")
          }
        }

        // 3. Calcular percentuais do total
        const totalUsdValue = walletTokens.reduce((sum, token) => sum + token.usdValue, 0)

        if (totalUsdValue > 0) {
          walletTokens.forEach(token => {
            token.percentOfTotal = (token.usdValue / totalUsdValue) * 100
          })
        }

        // 4. Sort by USD value (highest first)
        walletTokens.sort((a, b) => b.usdValue - a.usdValue)

        setTokens(walletTokens)
        setError(null)
        hasLoadedRef.current = true
      } catch (err) {
        console.error("Error fetching wallet tokens:", err)
        setError(`Failed to load wallet tokens: ${err instanceof Error ? err.message : 'Unknown error'}`)
        setTokens([])
      } finally {
        setIsLoading(false)
      }
    }

    getTokenBalances()

    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    refreshTimerRef.current = setInterval(() => {
      getTokenBalances()
    }, 15000)

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [walletAddress, isWalletConnected, solanaWalletData?.publicKey?.toString(), solanaWalletData?.connected, connection])

  return { tokens, isLoading, error }
}
