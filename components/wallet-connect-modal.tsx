"use client"

import React, { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { WALLET_CONFIGS } from "@/config/wallet-config"
import { useWalletContext } from "@/components/wallet-provider"

interface WalletConnectModalProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

export function WalletConnectModal({ isOpen, setIsOpen }: WalletConnectModalProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { connect, connectStandard, detectedWallets, isConnected } = useWalletContext()

  // Names already covered by the static buttons below — avoid duplicating
  // them in the "Detected" section.
  const staticNames = new Set(
    Object.values(WALLET_CONFIGS).map((c) => c.name.toLowerCase()),
  )
  const extraDetected = detectedWallets.filter(
    (w) => !staticNames.has(w.name.toLowerCase()),
  )
  
  // Mount component only on client-side to avoid hydration errors
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close modal if already connected
  useEffect(() => {
    if (isConnected) {
      setIsOpen(false)
    }
  }, [isConnected, setIsOpen])

  // Function to connect a detected Wallet Standard wallet by name (e.g.
  // "MetaMask" via Snaps Solana). Routes through connectStandard so the
  // exact wallet the user has gets used.
  const connectDetected = async (walletName: string) => {
    const loadingKey = `standard:${walletName}`
    setLoading(loadingKey)
    try {
      await connectStandard(walletName)
      toast.success(`Connected to ${walletName} successfully!`)
      setIsOpen(false)
    } catch (error: any) {
      console.error(`Error connecting to ${walletName}:`, error)
      if (error.message && error.message.includes('User rejected')) {
        toast.error(`Connection to ${walletName} was rejected by user`)
      } else {
        toast.error(`Failed to connect to ${walletName}. ${error.message || 'Please try again.'}`)
      }
    } finally {
      setLoading(null)
    }
  }

  // Function to connect wallet using the context
  const connectWallet = async (walletType: string) => {
    setLoading(walletType)
    try {
      await connect(walletType)
      toast.success(`Connected to ${WALLET_CONFIGS[walletType]?.name || walletType} successfully!`)
      setIsOpen(false)
    } catch (error: any) {
      console.error(`Error connecting to ${walletType}:`, error)
      
      // Handle specific errors
      if (error.message && error.message.includes("User rejected")) {
        toast.error(`Connection to ${walletType} was rejected by user`)
      } else if (error?.code === 'WALLET_NOT_FOUND' || error?.name === 'WalletNotFoundError') {
        toast.error(`${WALLET_CONFIGS[walletType]?.name || walletType} wallet not detected. Please install it to continue.`)
        // Open wallet website
        const walletUrl = WALLET_CONFIGS[walletType]?.url || 'https://phantom.app/'
        setTimeout(() => {
          window.open(walletUrl, '_blank')
        }, 2000)
      } else {
        toast.error(`Failed to connect to ${WALLET_CONFIGS[walletType]?.name || walletType}. ${error.message || 'Please try again.'}`)
      }
    } finally {
      setLoading(null)
    }
  }

  // Don't render during SSR to avoid hydration errors
  if (!mounted) return null
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-xl border-0">
        <div className="flex flex-col w-full">
          {/* Header */}
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-bold text-center">
                Connect Wallet
              </DialogTitle>
              <DialogDescription className="text-center">
                Choose your Solana wallet to connect
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Divider */}
          <div className="px-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
            </div>
          </div>

          {/* Detected wallets (Wallet Standard) — auto-discovered from
              the browser. Covers MetaMask Snaps Solana and any other
              wallet not in the static list. */}
          {extraDetected.length > 0 && (
            <div className="px-6 pt-6 bg-slate-50 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
                Detected in your browser
              </p>
              <div className="flex flex-col space-y-3">
                {extraDetected.map((w) => {
                  const key = `standard:${w.name}`
                  return (
                    <Button
                      key={key}
                      onClick={() => connectDetected(w.name)}
                      variant="outline"
                      className="justify-start py-6 px-4 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      disabled={loading !== null}
                    >
                      <div className="flex items-center w-full">
                        <div className="w-8 h-8 mr-4 flex items-center justify-center">
                          {w.icon ? (
                            <img
                              src={w.icon}
                              alt={`${w.name} Wallet`}
                              width={32}
                              height={32}
                              className="max-w-full max-h-full rounded-full overflow-hidden"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                          )}
                        </div>
                        <span className="font-semibold">
                          {loading === key ? 'Connecting...' : w.name}
                        </span>
                      </div>
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Solana Wallets */}
          <div className="p-6 bg-slate-50 dark:bg-slate-900">
            <div className="flex flex-col space-y-3">
              {Object.entries(WALLET_CONFIGS).map(([key, config]) => (
                <Button
                  key={key}
                  onClick={() => connectWallet(key)}
                  variant="outline"
                  className="justify-start py-6 px-4 border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  disabled={loading !== null}
                >
                  <div className="flex items-center w-full">
                    <div className="w-8 h-8 mr-4 flex items-center justify-center">
                      <img
                        src={config.icon}
                        alt={`${config.name} Wallet`}
                        width={32}
                        height={32}
                        className="max-w-full max-h-full rounded-full overflow-hidden"
                      />
                    </div>
                    <span className="font-semibold">
                      {loading === key ? 'Connecting...' : config.name}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
          
        </div>
      </DialogContent>
    </Dialog>
  )
}
