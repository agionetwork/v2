"use client"

import { useCallback, useRef } from "react"
import { useWallet } from "@solana/wallet-adapter-react"

/** Module-level cache so sign only happens once across all components */
let authCache: { signature: string; message: string; wallet: string } | null =
  null

/** Module-level pending promise to prevent concurrent sign requests */
let pendingAuth: Promise<string | null> | null = null

export function useAgentAuth() {
  const { signMessage, publicKey } = useWallet()

  // Use refs so getAuthQuery has a stable identity (no deps that change)
  const signMessageRef = useRef(signMessage)
  const publicKeyRef = useRef(publicKey)
  signMessageRef.current = signMessage
  publicKeyRef.current = publicKey

  const getAuthQuery = useCallback(async (): Promise<string | null> => {
    if (!signMessageRef.current || !publicKeyRef.current) return null

    const walletAddr = publicKeyRef.current.toBase58()

    // Return cached if same wallet
    if (authCache && authCache.wallet === walletAddr) {
      return `signature=${encodeURIComponent(authCache.signature)}&message=${encodeURIComponent(authCache.message)}`
    }

    // Prevent concurrent sign requests (React Strict Mode double-mount)
    if (pendingAuth) return pendingAuth

    pendingAuth = (async () => {
      try {
        const message = `agio-auth:${walletAddr}`
        const sig = await signMessageRef.current!(new TextEncoder().encode(message))
        const signature = Buffer.from(sig).toString("base64")
        authCache = { signature, message, wallet: walletAddr }
        return `signature=${encodeURIComponent(signature)}&message=${encodeURIComponent(message)}`
      } catch {
        return null
      } finally {
        pendingAuth = null
      }
    })()

    return pendingAuth
  }, [])

  const clearAuth = useCallback(() => {
    authCache = null
  }, [])

  return { getAuthQuery, clearAuth }
}
