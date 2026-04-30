import { NextResponse } from "next/server"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { parseLoanAccounts, LoanStatus } from "@/lib/loan-utils"
import { buildRepayLoanTx } from "@/lib/agent/transaction-builder"
import { signAndSendTransaction } from "@/lib/agent/privy"
import { resolveOwner } from "@/lib/resolve-owner"
import { PublicKey } from "@solana/web3.js"

/**
 * POST /api/admin/migrate-loans
 *
 * One-time migration for legacy loans that were repaid before FIX-006
 * (interest calculation fix) but remain Active on-chain with debtAmount=0.
 * Re-triggers repay to finalize them on-chain and release collateral.
 *
 * Note: The API layer already treats these as Repaid (parseLoanAccounts
 * overrides status when debtAmount=0 + Active). This endpoint fixes the
 * ON-CHAIN state to actually release locked collateral.
 *
 * Protected: requires ADMIN_SECRET header.
 */
const LEGACY_LOANS = [
  "74WHXXj6ZcttgH6Myt1MS5Jxf1UzYu2hoFAk96Zaefd3",
  "HW3TeuH5AssLsjF4cv3RYVmM6JiMyURKeUSx8GEa9VJL",
]

export async function POST(request: Request) {
  // Simple admin auth
  const adminSecret = process.env.ADMIN_SECRET
  const authHeader = request.headers.get("x-admin-secret")
  if (adminSecret && authHeader !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const connection = createConnection()
  const program = createReadonlyProgram(connection)
  const allAccounts = await (program.account as any).loan.all()

  // Parse but also keep raw accounts for on-chain status check
  const allLoans = parseLoanAccounts(allAccounts)
  const rawStatusMap = new Map<string, number>()
  for (const acc of allAccounts) {
    rawStatusMap.set(acc.publicKey.toBase58(), acc.account.status)
  }

  const results: any[] = []

  for (const loanPk of LEGACY_LOANS) {
    const loan = allLoans.find((l) => l.publicKey === loanPk)
    if (!loan) {
      results.push({ loanPk, status: "not_found" })
      continue
    }

    // Check RAW on-chain status (not the API-overridden one)
    const rawStatus = rawStatusMap.get(loanPk)
    if (rawStatus === LoanStatus.Repaid) {
      results.push({ loanPk, status: "already_repaid_onchain" })
      continue
    }

    if (rawStatus !== LoanStatus.Accepted) {
      results.push({ loanPk, status: "skipped", reason: `Unexpected on-chain status: ${rawStatus}` })
      continue
    }

    if (!loan.borrower) {
      results.push({ loanPk, status: "skipped", reason: "No borrower set" })
      continue
    }

    // Resolve borrower agent wallet → owner wallet (uses global fallback)
    const ownerWallet = await resolveOwner(loan.borrower)
    if (ownerWallet === loan.borrower) {
      results.push({ loanPk, status: "skipped", reason: `Could not resolve owner for agent ${loan.borrower}` })
      continue
    }

    // debtAmount is 0 on-chain, so total owed is ~0. Try repay with minimal amount.
    // The contract should see total_owed ≈ 0 and transition to Repaid.
    const repayAmount = 0.0001

    try {
      const agentPk = new PublicKey(loan.borrower)
      const serializedTx = await buildRepayLoanTx(connection, program, agentPk, loan, repayAmount)
      const txHash = await signAndSendTransaction(ownerWallet, serializedTx)

      results.push({
        loanPk,
        status: "migrated",
        txHash,
        ownerWallet,
        repayAmount,
        rawOnChainStatus: rawStatus,
        debtAmountUi: loan.debtAmountUi,
        collateralLocked: loan.collateralAmountUi,
      })
    } catch (err: any) {
      results.push({
        loanPk,
        status: "error",
        error: err.message,
        ownerWallet,
        repayAmount,
        hint: "On-chain repay failed. Collateral remains locked. The API layer still displays these as Repaid.",
      })
    }
  }

  return NextResponse.json({
    success: true,
    migrated: results.filter((r) => r.status === "migrated").length,
    results,
  })
}
