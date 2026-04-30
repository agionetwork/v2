"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

export function RiskAssessment() {
  const [loanAmount, setLoanAmount] = React.useState(0)
  const [collateral, setCollateral] = React.useState(0)
  const [term, setTerm] = React.useState(30)
  const [riskScore, setRiskScore] = React.useState(0)

  const calculateRisk = () => {
    // This is a simplified risk calculation. In a real application, this would be much more complex.
    const collateralRatio = collateral / loanAmount
    const termFactor = term / 365
    const rawScore = collateralRatio * 50 + 50 / termFactor
    setRiskScore(Math.min(Math.max(rawScore, 0), 100))
  }

  return (
    <div className="space-y-3 max-w-sm mx-auto">
      <h2 className="text-lg font-semibold dark:text-white">Loan Risk Assessment</h2>
      <div className="grid gap-3">
        <div className="grid grid-cols-3 items-center gap-3">
          <Label htmlFor="loan-amount" className="text-right text-sm dark:text-white">
            Loan Amount (SOL)
          </Label>
          <Input
            id="loan-amount"
            type="number"
            className="col-span-2 h-8 text-sm"
            value={loanAmount}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
          />
        </div>
        <div className="grid grid-cols-3 items-center gap-3">
          <Label htmlFor="collateral" className="text-right text-sm dark:text-white">
            Collateral (SOL)
          </Label>
          <Input
            id="collateral"
            type="number"
            className="col-span-2 h-8 text-sm"
            value={collateral}
            onChange={(e) => setCollateral(Number(e.target.value))}
          />
        </div>
        <div className="grid grid-cols-3 items-center gap-3">
          <Label htmlFor="term" className="text-right text-sm dark:text-white">
            Term (Days)
          </Label>
          <Input
            id="term"
            type="number"
            className="col-span-2 h-8 text-sm"
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
          />
        </div>
      </div>
      <Button onClick={calculateRisk} className="w-3/4 mx-auto h-8 text-sm bg-blue-600 hover:bg-blue-700 text-white">Calculate Risk</Button>
      {riskScore > 0 && (
        <div className="space-y-1">
          <Label className="text-sm dark:text-white">Risk Score</Label>
          <Progress value={riskScore} className="w-full h-2" />
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            {riskScore < 33 ? "High Risk" : riskScore < 66 ? "Medium Risk" : "Low Risk"}
          </p>
        </div>
      )}
    </div>
  )
}

