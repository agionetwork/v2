import { NextRequest, NextResponse } from "next/server"
import { PublicKey } from "@solana/web3.js"
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor"
import { createConnection } from "@/lib/program"
import { verifyWalletSignature } from "@/lib/agent/auth"
import { getStealthOwner, signAndSendWithStealth } from "@/lib/agent/stealth"
import { buildCreateLendOfferTx } from "@/lib/agent/transaction-builder"
import { postPricesForTokens, validateLoanTerms } from "@/lib/mcp/tools/lending"
import IDL from "@/lib/idl/agio.json"

/**
 * Create a private lend offer signed by the user's stealth wallet.
 *
 * Flow:
 *   1. Auth (signature on `wallet`)
 *   2. Verify stealthPubkey belongs to caller
 *   3. Validate loan terms against protocol limits
 *   4. Bot keypair posts Pyth prices on-chain
 *   5. Build createBorrowOffer ix (program calls it that — agent-as-LENDER builder)
 *      with stealthPubkey as the lender + feePayer
 *   6. Stealth signs + we broadcast via Helius
 *   7. Cleanup ephemeral price-update accounts
 *
 * Pre-condition: caller already funded the stealth wallet via Cloak round-trip
 * (debt token + a small SOL buffer for tx fees + ATA rent).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      wallet,
      signature,
      message,
      stealthPublicKey,
      debtTokenSymbol,
      collateralTokenSymbol,
      debtAmount,
      collateralAmount,
      duration,
      apy,
    } = body

    if (
      !wallet ||
      !signature ||
      !message ||
      !stealthPublicKey ||
      !debtTokenSymbol ||
      !collateralTokenSymbol ||
      typeof debtAmount !== "number" ||
      typeof collateralAmount !== "number" ||
      typeof duration !== "number" ||
      typeof apy !== "number"
    ) {
      return NextResponse.json({ error: "Missing or invalid params" }, { status: 400 })
    }

    if (!verifyWalletSignature(wallet, signature, message)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const owner = await getStealthOwner(stealthPublicKey)
    if (owner !== wallet) {
      return NextResponse.json(
        { error: "Stealth wallet does not belong to caller" },
        { status: 403 },
      )
    }

    const validation = await validateLoanTerms({
      debtToken: debtTokenSymbol,
      collateralToken: collateralTokenSymbol,
      debtAmount,
      collateralAmount,
      apy,
      mode: "create",
    })
    if (validation) {
      return NextResponse.json({ error: validation }, { status: 400 })
    }

    const connection = createConnection()
    const stealthPk = new PublicKey(stealthPublicKey)
    const provider = new AnchorProvider(
      connection,
      // Read-only provider — actual signing is done via Privy stealth flow.
      {
        publicKey: stealthPk,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
      } as any,
      { commitment: "confirmed" },
    )
    const program = new Program(IDL as unknown as Idl, provider)

    // Two attempts: if the first fails with PriceFeedStale (program error
    // 0x178e / code 6030), the Pyth post → stealth sign window crossed the
    // 60s limit. Re-post fresh prices and retry once. Anything else bubbles up.
    let txHash: string | undefined
    let lastErr: any
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { collateralPriceUpdate, debtPriceUpdate, cleanup } = await postPricesForTokens(
        connection,
        collateralTokenSymbol,
        debtTokenSymbol,
      )
      try {
        const serializedTx = await buildCreateLendOfferTx(
          connection,
          program,
          stealthPk,
          {
            debtTokenSymbol,
            collateralTokenSymbol,
            debtAmount,
            collateralAmount,
            duration,
            apy,
          },
          { collateralPriceUpdate, debtPriceUpdate },
        )
        txHash = await signAndSendWithStealth(stealthPublicKey, serializedTx)
        break
      } catch (err: any) {
        lastErr = err
        const msg = String(err?.message ?? err ?? "")
        const isStale =
          /PriceFeedStale/i.test(msg) || /0x178e/i.test(msg) || /price feed is too stale/i.test(msg)
        if (!isStale || attempt === 2) throw err
        console.warn(`[private-offer/create-lend] attempt ${attempt} stale price, retrying with fresh post`)
      } finally {
        cleanup().catch(() => {})
      }
    }
    if (!txHash) throw lastErr ?? new Error("create-lend failed without surfacing an error")

    return NextResponse.json({ success: true, txHash, stealthPublicKey })
  } catch (err: any) {
    console.error("[private-offer/create-lend]", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
