import { NextRequest, NextResponse } from "next/server"
import { Receiver } from "@upstash/qstash"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { parseLoanAccounts, LoanStatus } from "@/lib/loan-utils"
import {
  isLoanWarnedTier,
  markLoanWarnedTier,
  isCollateralWarned,
  markCollateralWarned,
  getOwnerByAgentPublicKey,
} from "@/lib/agent/redis"
import { notifyLoanExpiryWarning, notifyCollateralWarning } from "@/lib/dialect"
import { fetchTokenPrices } from "@/lib/token-prices"

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
})

// Warning tiers: each loan can receive up to 3 warnings at different urgency levels
const WARNING_TIERS = [
  { tier: "48h", maxSeconds: 48 * 3600, ttl: 48 * 3600 },
  { tier: "24h", maxSeconds: 24 * 3600, ttl: 24 * 3600 },
  { tier: "1h",  maxSeconds: 1  * 3600, ttl: 1  * 3600 },
] as const

// Collateral ratio threshold — warn when below this (liquidation threshold is ~120%)
const COLLATERAL_WARN_RATIO = 130

export async function POST(req: NextRequest) {
  // Verify QStash signature
  try {
    const body = await req.text()
    const signature = req.headers.get("upstash-signature") || ""

    const isValid = await receiver.verify({
      body,
      signature,
      url: req.url,
    })

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  } catch {
    // Allow local dev without QStash
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 })
    }
  }

  const startTime = Date.now()
  const MAX_RUNTIME_MS = 50_000 // 50s guard (Vercel limit = 60s)

  try {
    const connection = createConnection()
    const program = createReadonlyProgram(connection)
    const allAccounts = await (program.account as any).loan.all()
    const loans = parseLoanAccounts(allAccounts)
    const now = Math.floor(Date.now() / 1000)

    // Active loans only
    const activeLoans = loans.filter((l) => l.status === LoanStatus.Accepted)

    let expiryWarned = 0
    let expirySkipped = 0
    let collateralWarned = 0
    let collateralSkipped = 0
    const errors: string[] = []

    // --- 1. Tiered expiry warnings (48h → 24h → 1h) ---
    for (const loan of activeLoans) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break
      if (!loan.borrower || !loan.start) continue

      const expiresAt = loan.start + loan.duration
      const timeRemaining = expiresAt - now
      if (timeRemaining <= 0) continue // already expired

      // Find the most urgent applicable tier
      const applicableTier = WARNING_TIERS.find((t) => timeRemaining <= t.maxSeconds)
      if (!applicableTier) continue // more than 48h remaining

      try {
        const alreadyWarned = await isLoanWarnedTier(loan.publicKey, applicableTier.tier)
        if (alreadyWarned) {
          expirySkipped++
          continue
        }

        const ownerWallet = (await getOwnerByAgentPublicKey(loan.borrower)) || loan.borrower
        const hoursRemaining = Math.max(1, Math.round(timeRemaining / 3600))

        await notifyLoanExpiryWarning(ownerWallet, {
          debtToken: loan.debtTokenSymbol,
          amount: loan.debtAmountUi,
          apy: loan.apy,
          hoursRemaining,
        })

        await markLoanWarnedTier(loan.publicKey, applicableTier.tier, applicableTier.ttl)
        expiryWarned++
      } catch (err: any) {
        errors.push(`expiry:${loan.publicKey}: ${err.message}`)
      }
    }

    // --- 2. Collateral ratio monitoring ---
    let prices: Record<string, number> | null = null
    try {
      prices = await fetchTokenPrices()
    } catch {
      errors.push("collateral: failed to fetch token prices")
    }

    if (prices) {
      for (const loan of activeLoans) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) break
        if (!loan.borrower || !loan.lender) continue

        // Calculate current collateral ratio
        const collateralPrice = prices[loan.collateralTokenSymbol?.toUpperCase() || ""] || 0
        const debtPrice = prices[loan.debtTokenSymbol?.toUpperCase() || ""] || 0
        if (!collateralPrice || !debtPrice) continue

        const collateralValueUsd = loan.collateralAmountUi * collateralPrice
        const debtValueUsd = loan.debtAmountUi * debtPrice
        if (debtValueUsd === 0) continue

        const currentRatio = (collateralValueUsd / debtValueUsd) * 100

        if (currentRatio >= COLLATERAL_WARN_RATIO) continue // healthy

        try {
          const alreadyWarned = await isCollateralWarned(loan.publicKey)
          if (alreadyWarned) {
            collateralSkipped++
            continue
          }

          // Notify borrower
          const borrowerOwner = (await getOwnerByAgentPublicKey(loan.borrower)) || loan.borrower
          await notifyCollateralWarning(borrowerOwner, {
            debtToken: loan.debtTokenSymbol,
            amount: loan.debtAmountUi,
            currentRatio,
            threshold: COLLATERAL_WARN_RATIO,
            role: "borrower",
          })

          // Notify lender
          const lenderOwner = (await getOwnerByAgentPublicKey(loan.lender)) || loan.lender
          await notifyCollateralWarning(lenderOwner, {
            debtToken: loan.debtTokenSymbol,
            amount: loan.debtAmountUi,
            currentRatio,
            threshold: COLLATERAL_WARN_RATIO,
            role: "lender",
          })

          await markCollateralWarned(loan.publicKey)
          collateralWarned++
        } catch (err: any) {
          errors.push(`collateral:${loan.publicKey}: ${err.message}`)
        }
      }
    }

    return NextResponse.json({
      message: "Loan warning cron completed",
      activeLoans: activeLoans.length,
      expiry: { warned: expiryWarned, skipped: expirySkipped },
      collateral: { warned: collateralWarned, skipped: collateralSkipped },
      errors: errors.length > 0 ? errors : undefined,
      durationMs: Date.now() - startTime,
    })
  } catch (err: any) {
    console.error("Loan warning cron error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
