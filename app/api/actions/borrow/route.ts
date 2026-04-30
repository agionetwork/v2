import { NextRequest } from "next/server"
import { PublicKey, Transaction } from "@solana/web3.js"
import { createPostResponse } from "@solana/actions"
import type { ActionGetResponse } from "@solana/actions-spec"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { buildCreateBorrowRequestTx } from "@/lib/agent/transaction-builder"
import { postPricesForTokens, validateLoanTerms } from "@/lib/mcp/tools/lending"
import { OPTIONS_RESPONSE, actionJsonResponse, actionErrorResponse } from "@/lib/actions/cors"
import { getActionIdentity } from "@/lib/actions/identity"

function isDevnet(): boolean {
  return (
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
    !!process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet")
  )
}

export async function GET(request: NextRequest) {
  const baseUrl = new URL(request.url).origin

  const response: ActionGetResponse = {
    icon: `${baseUrl}/agio-logo-3d.png`,
    title: "Agio \u2014 Borrow Tokens",
    description:
      "Create a borrow request on Agio DeFi. You deposit collateral into escrow and receive tokens when a lender accepts. 1% origination fee deducted on-chain at acceptance.",
    label: "Borrow",
    links: {
      actions: [
        {
          type: "transaction",
          label: "Borrow 10 USDC",
          href: `${baseUrl}/api/actions/borrow?debtToken=USDC&amount=10&collateralToken=SOL&duration=1&apy=5`,
        },
        {
          type: "transaction",
          label: "Borrow 50 USDC",
          href: `${baseUrl}/api/actions/borrow?debtToken=USDC&amount=50&collateralToken=SOL&duration=1&apy=5`,
        },
        {
          type: "transaction",
          label: "Custom Request",
          href: `${baseUrl}/api/actions/borrow?debtToken={debtToken}&amount={amount}&collateralToken={collateralToken}&collateralAmount={collateralAmount}&duration={duration}&apy={apy}`,
          parameters: [
            {
              type: "select",
              name: "debtToken",
              label: "Token to Borrow",
              required: true,
              options: [
                { label: "USDC", value: "USDC", selected: true },
                { label: "EURC", value: "EURC" },
                { label: "SOL", value: "SOL" },
              ],
            },
            {
              type: "number",
              name: "amount",
              label: "Borrow Amount",
              required: true,
              min: 1,
            },
            {
              type: "select",
              name: "collateralToken",
              label: "Collateral Token",
              required: true,
              options: [
                { label: "SOL", value: "SOL", selected: true },
                { label: "USDC", value: "USDC" },
                { label: "EURC", value: "EURC" },
              ],
            },
            {
              type: "number",
              name: "collateralAmount",
              label: "Collateral Amount",
              required: true,
              min: 0.01,
            },
            {
              type: "select",
              name: "duration",
              label: "Duration (days)",
              required: true,
              options: isDevnet()
                ? [{ label: "1 day", value: "1", selected: true }]
                : [
                    { label: "7 days", value: "7", selected: true },
                    { label: "14 days", value: "14" },
                    { label: "30 days", value: "30" },
                  ],
            },
            {
              type: "number",
              name: "apy",
              label: "APY %",
              required: true,
              min: 0,
              max: 200,
            },
          ],
        },
      ],
    },
  }

  return actionJsonResponse(response)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account } = body
    if (!account) return actionErrorResponse("Missing account in request body")

    let userPubkey: PublicKey
    try {
      userPubkey = new PublicKey(account)
    } catch {
      return actionErrorResponse("Invalid account public key")
    }

    const url = new URL(request.url)
    const debtToken = url.searchParams.get("debtToken")
    const amountStr = url.searchParams.get("amount")
    const collateralToken = url.searchParams.get("collateralToken")
    const collateralAmountStr = url.searchParams.get("collateralAmount")
    const durationStr = url.searchParams.get("duration")
    const apyStr = url.searchParams.get("apy")

    if (!debtToken || !amountStr || !collateralToken || !durationStr || !apyStr) {
      return actionErrorResponse("Missing required parameters: debtToken, amount, collateralToken, duration, apy")
    }

    const amount = parseFloat(amountStr)
    const duration = parseInt(durationStr, 10)
    const apy = parseFloat(apyStr)

    if (isNaN(amount) || amount <= 0) return actionErrorResponse("Invalid amount")
    if (isNaN(duration) || duration <= 0) return actionErrorResponse("Invalid duration")
    if (isNaN(apy) || apy < 0) return actionErrorResponse("Invalid APY")

    if (debtToken === collateralToken) {
      return actionErrorResponse("Debt and collateral tokens must be different")
    }

    if (!["USDC", "EURC", "SOL"].includes(debtToken) || !["USDC", "EURC", "SOL"].includes(collateralToken)) {
      return actionErrorResponse("Supported tokens: USDC, EURC, SOL")
    }

    if (isDevnet() && duration > 1) {
      return actionErrorResponse("Devnet loans are limited to 1 day")
    }

    // Compute collateral: use user-provided value or compute 150% from oracle
    let collateralAmount: number
    if (collateralAmountStr) {
      collateralAmount = parseFloat(collateralAmountStr)
      if (isNaN(collateralAmount) || collateralAmount <= 0) {
        return actionErrorResponse("Invalid collateral amount")
      }
    } else {
      const { fetchTokenPrices } = await import("@/lib/token-prices")
      const prices = await fetchTokenPrices()
      const debtPrice = prices[debtToken] ?? 1
      const collateralPrice = prices[collateralToken] ?? 1
      // 155% to add buffer above 150% minimum (avoids floating-point edge rejection)
      collateralAmount = (amount * debtPrice * 1.55) / collateralPrice
    }

    const termError = await validateLoanTerms({
      debtToken,
      collateralToken,
      debtAmount: amount,
      collateralAmount,
      apy,
    })
    if (termError) return actionErrorResponse(termError)

    const connection = createConnection()
    const program = createReadonlyProgram(connection)

    const { collateralPriceUpdate, debtPriceUpdate, cleanup } =
      await postPricesForTokens(connection, debtToken, collateralToken)

    let serializedTx: string
    try {
      serializedTx = await buildCreateBorrowRequestTx(connection, program, userPubkey, {
        debtTokenSymbol: debtToken,
        collateralTokenSymbol: collateralToken,
        debtAmount: amount,
        collateralAmount,
        duration: duration * 86400,
        apy,
      }, {
        collateralPriceUpdate,
        debtPriceUpdate,
      })
    } catch (err: any) {
      await cleanup().catch(() => {})
      return actionErrorResponse(err.message || "Failed to build transaction", 500)
    }

    setTimeout(() => cleanup().catch(() => {}), 120_000)

    const tx = Transaction.from(Buffer.from(serializedTx, "base64"))
    const actionIdentity = getActionIdentity()

    const postResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction: tx,
        message: `Borrow request: ${amount} ${debtToken} with ${collateralAmount.toFixed(4)} ${collateralToken} collateral at ${apy}% APY`,
      },
      ...(actionIdentity ? { actionIdentity } : {}),
    })

    return actionJsonResponse(postResponse)
  } catch (err: any) {
    console.error("Actions borrow POST error:", err)
    return actionErrorResponse(err.message || "Internal server error", 500)
  }
}

export async function OPTIONS() {
  return OPTIONS_RESPONSE()
}
