import { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoanSummary } from "@/types/loan"
import { formatCurrency } from "@/lib/utils"

interface LoanSummaryProps {
  summary: LoanSummary
  token: string
}

function LoanSummaryComponent({ summary, token }: LoanSummaryProps) {
  return (
    <Card className="bg-white/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Loan Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Repayment:</span>
          <span className="font-medium">
            {formatCurrency(summary.totalRepayment)} {token}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Interest:</span>
          <span className="font-medium">
            {formatCurrency(summary.interest)} {token}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Daily Interest:</span>
          <span className="font-medium">
            {formatCurrency(summary.dailyInterest)} {token}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export const LoanSummaryView = memo(LoanSummaryComponent) 