"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type RiskScore = {
  overall: number
  factors: {
    reputation: number
    collateral: number
    history: number
    activity: number
  }
}

const defaultRiskScore: RiskScore = {
  overall: 0,
  factors: {
    reputation: 0,
    collateral: 0,
    history: 0,
    activity: 0
  }
}

function RiskFactorCard({ title, score }: { title: string; score: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{score}%</div>
        <div className="mt-4 h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{ width: `${score}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default function RiskAssessmentPage() {
  const [address, setAddress] = useState("")
  const [token, setToken] = useState("SOL")
  const [amount, setAmount] = useState("")

  const handleAssess = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implementar lógica de avaliação de risco
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Risk Assessment</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Risk Score</CardTitle>
              <CardDescription>Overall risk assessment based on multiple factors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-8">
                <div className="text-5xl font-bold mb-2">{defaultRiskScore.overall}%</div>
                <p className="text-muted-foreground">Overall Risk Score</p>
              </div>
              <div className="grid gap-4">
                <RiskFactorCard title="Reputation Score" score={defaultRiskScore.factors.reputation} />
                <RiskFactorCard title="Collateral Rating" score={defaultRiskScore.factors.collateral} />
                <RiskFactorCard title="Loan History" score={defaultRiskScore.factors.history} />
                <RiskFactorCard title="Platform Activity" score={defaultRiskScore.factors.activity} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Assess New Address</CardTitle>
              <CardDescription>Enter details to assess risk for a new loan</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAssess} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="address">Wallet Address</Label>
                  <Input
                    id="address"
                    placeholder="Enter wallet address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token">Token</Label>
                  <Select value={token} onValueChange={setToken}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SOL">SOL</SelectItem>
                      <SelectItem value="USDC">USDC</SelectItem>
                      <SelectItem value="USDT">USDT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Assess Risk
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 