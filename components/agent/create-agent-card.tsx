"use client"

import { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bot, Loader2, Shield, Zap, Settings } from "lucide-react"
import { toast } from "sonner"

interface Props {
  wallet: string
  onCreated: () => void
}

export function CreateAgentCard({ wallet, onCreated }: Props) {
  const { signMessage } = useWallet()
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!signMessage) {
      toast.error("Wallet does not support message signing")
      return
    }

    setCreating(true)
    try {
      const message = `Create AI Agent for ${wallet} at ${Date.now()}`
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(messageBytes)
      const signature = Buffer.from(signatureBytes).toString("base64")

      const res = await fetch("/api/agent/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, signature, message }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create agent")
      }

      toast.success("AI Agent created successfully!")
      onCreated()
    } catch (err: any) {
      toast.error(err.message || "Failed to create agent")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="border-2 border-dashed border-blue-300 dark:border-blue-700">
      <CardContent className="p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <Bot className="h-8 w-8 text-blue-600" />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold">Create your AI Agent</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your agent gets its own wallet and automatically manages loans on your behalf
            based on your configured parameters.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
          <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Shield className="h-5 w-5 text-green-600" />
            <p className="text-xs text-muted-foreground text-center">Secure wallet via Privy TEE</p>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Zap className="h-5 w-5 text-yellow-600" />
            <p className="text-xs text-muted-foreground text-center">Auto accept, foreclose & repay</p>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Settings className="h-5 w-5 text-blue-600" />
            <p className="text-xs text-muted-foreground text-center">Full control over parameters</p>
          </div>
        </div>

        <Button
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating Agent...
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 mr-2" />
              Create Agent
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
