import { NextRequest } from "next/server"
import { PublicKey, Transaction } from "@solana/web3.js"
import { createPostResponse } from "@solana/actions"
import type { ActionGetResponse } from "@solana/actions-spec"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { buildRepayLoanTx } from "@/lib/agent/transaction-builder"
import { parseLoanAccount, LoanStatus, calculateInterest } from "@/lib/loan-utils"
import { OPTIONS_RESPONSE, actionJsonResponse, actionErrorResponse } from "@/lib/actions/cors"
import { getActionIdentity } from "@/lib/actions/identity"

async function fetchLoanByPubkey(loanPublicKey: string) {
  const connection = createConnection()
  const program = createReadonlyProgram(connection)
  try {
    const pk = new PublicKey(loanPublicKey)
    const account = await (program.account as any).loan.fetch(pk)
    return parseLoanAccount(pk, account)
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loanPublicKey: string }> },
) {
  const { loanPublicKey } = await params
  const baseUrl = new URL(request.url).origin

  const loan = await fetchLoanByPubkey(loanPublicKey)
  if (!loan) {
    return actionErrorResponse("Loan not found", 404)
  }

  if (loan.status !== LoanStatus.Accepted) {
    const response: ActionGetResponse = {
      icon: `${baseUrl}/agio-logo-3d.png`,
      title: "Agio \u2014 Loan Not Active",
      description: `This loan is not active (status: ${LoanStatus[loan.status]}). Only active loans can be repaid.`,
      label: "Unavailable",
      disabled: true,
    }
    return actionJsonResponse(response)
  }

  const interest = calculateInterest(loan)
  const totalOwed = loan.debtAmountUi + interest

  const response: ActionGetResponse = {
    icon: `${baseUrl}/agio-logo-3d.png`,
    title: `Agio \u2014 Repay ${totalOwed.toFixed(4)} ${loan.debtTokenSymbol}`,
    description:
      `Repay this loan: ${loan.debtAmountUi} ${loan.debtTokenSymbol} principal + ${interest.toFixed(4)} ${loan.debtTokenSymbol} interest. ` +
      `Your ${loan.collateralAmountUi} ${loan.collateralTokenSymbol} collateral will be returned.`,
    label: "Repay Loan",
    links: {
      actions: [
        {
          type: "transaction",
          label: `Repay ${totalOwed.toFixed(4)} ${loan.debtTokenSymbol}`,
          href: `${baseUrl}/api/actions/repay/${loanPublicKey}`,
        },
      ],
    },
  }

  return actionJsonResponse(response)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loanPublicKey: string }> },
) {
  try {
    const { loanPublicKey } = await params
    const body = await request.json()
    const { account } = body
    if (!account) return actionErrorResponse("Missing account in request body")

    let userPubkey: PublicKey
    try {
      userPubkey = new PublicKey(account)
    } catch {
      return actionErrorResponse("Invalid account public key")
    }

    const loan = await fetchLoanByPubkey(loanPublicKey)
    if (!loan) return actionErrorResponse("Loan not found", 404)
    if (loan.status !== LoanStatus.Accepted) {
      return actionErrorResponse("Loan is not active")
    }

    // Only the borrower can repay
    const userAddr = userPubkey.toBase58()
    if (loan.borrower !== userAddr) {
      return actionErrorResponse("Only the borrower can repay this loan")
    }

    const interest = calculateInterest(loan)
    const totalOwed = loan.debtAmountUi + interest

    const connection = createConnection()
    const program = createReadonlyProgram(connection)

    let serializedTx: string
    try {
      serializedTx = await buildRepayLoanTx(
        connection,
        program,
        userPubkey,
        loan,
        loan.debtAmountUi, // full repay (on-chain caps to remaining principal)
      )
    } catch (err: any) {
      return actionErrorResponse(err.message || "Failed to build transaction", 500)
    }

    const tx = Transaction.from(Buffer.from(serializedTx, "base64"))
    const actionIdentity = getActionIdentity()

    const postResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction: tx,
        message: `Repaid ${totalOwed.toFixed(4)} ${loan.debtTokenSymbol} (${loan.debtAmountUi} principal + ${interest.toFixed(4)} interest)`,
      },
      ...(actionIdentity ? { actionIdentity } : {}),
    })

    return actionJsonResponse(postResponse)
  } catch (err: any) {
    console.error("Actions repay POST error:", err)
    return actionErrorResponse(err.message || "Internal server error", 500)
  }
}

export async function OPTIONS() {
  return OPTIONS_RESPONSE()
}
