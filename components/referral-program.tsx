"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"

export function ReferralProgram() {
  const [referralCode, setReferralCode] = React.useState(
    "AGIO-" + Math.random().toString(36).substring(7).toUpperCase(),
  )

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode)
    toast({
      title: "Referral Code Copied",
      description: "Your referral code has been copied to the clipboard.",
    })
  }

  return (
    <div className="space-y-3 max-w-sm mx-auto">
      <h2 className="text-lg font-semibold">Referral Program</h2>
      <p className="text-sm text-muted-foreground">Invite friends and earn rewards when they join AGIO NETWORK.</p>
      <div className="flex items-center gap-2">
        <Input value={referralCode} readOnly className="h-8 text-sm" />
        <Button onClick={copyReferralCode} className="h-8 text-sm px-3 bg-blue-600 hover:bg-blue-700 text-white">Copy</Button>
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Invited Users</Label>
        <p className="text-lg font-semibold">10</p>
        <p className="text-xs text-muted-foreground">Earned from 10 referrals</p>
      </div>
      <Button className="w-full h-8 text-sm bg-blue-600 hover:bg-blue-700 text-white">Share Referral Link</Button>
    </div>
  )
}

