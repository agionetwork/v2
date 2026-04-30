import { NextRequest, NextResponse } from "next/server"
import { Receiver } from "@upstash/qstash"
import {
  Connection,
  Keypair,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js"
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor"
import { SOLANA_CONFIG } from "@/config/solana"
import { parseLoanAccounts, LoanStatus } from "@/lib/loan-utils"
import { TOKEN_MINTS } from "@/lib/token-mints"
import { PYTH_FEED_IDS, fetchTokenPrices } from "@/lib/token-prices"
import {
  fetchHermesUpdates,
  buildPostPriceUpdateInstructions,
} from "@/lib/pyth-poster"
import { buildRescindUndercollateralizedOfferIx } from "@/lib/agent/transaction-builder"
import { getRedis } from "@/lib/agent/redis"
import { SECURITY_CONFIG } from "@/lib/security-config"
import IDL from "@/lib/idl/agio.json"

const RESCIND_DEDUP_PREFIX = "rescind:undercollateral:"
const RESCIND_DEDUP_TTL = 3600 // 1 hour

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
})

const MINT_TO_FEED_ID: Record<string, string> = {}
for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
  if (PYTH_FEED_IDS[symbol]) {
    MINT_TO_FEED_ID[mint.toBase58()] = PYTH_FEED_IDS[symbol]
  }
}

function loadBotKeypair(): Keypair {
  const raw = process.env.FORECLOSURE_BOT_KEYPAIR
  if (!raw) throw new Error("FORECLOSURE_BOT_KEYPAIR env var required")
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)))
}

export async function POST(req: NextRequest) {
  // Verify QStash signature
  try {
    const body = await req.text()
    const signature = req.headers.get("upstash-signature") || ""
    const isValid = await receiver.verify({ body, signature, url: req.url })
    if (!isValid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  } catch {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 })
    }
  }

  const startTime = Date.now()
  const MAX_RUNTIME_MS = 50_000

  try {
    const botKeypair = loadBotKeypair()
    const connection = new Connection(SOLANA_CONFIG.RPC_URL, "confirmed")

    const wallet = {
      publicKey: botKeypair.publicKey,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    }
    const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" })
    const program = new Program(IDL as unknown as Idl, provider)

    // Fetch all loans and filter pending offers
    const allAccounts = await (program.account as any).loan.all()
    const loans = parseLoanAccounts(allAccounts)
    const pendingOffers = loans.filter((l) => {
      if (l.status !== LoanStatus.Pending) return false
      // Must have exactly one party (creator)
      return (!!l.lender && !l.borrower) || (!!l.borrower && !l.lender)
    })

    if (pendingOffers.length === 0) {
      return NextResponse.json({
        message: "No pending offers to check",
        durationMs: Date.now() - startTime,
      })
    }

    // Fetch oracle prices to pre-filter before on-chain calls
    const prices = await fetchTokenPrices()
    const MIN_RATIO = SECURITY_CONFIG.VALIDATION.MIN_ACCEPT_COLLATERAL_RATIO

    // Identify under-collateralized offers
    const undercollateralized = pendingOffers.filter((loan) => {
      const colPrice = prices[loan.collateralTokenSymbol] || 0
      const debtPrice = prices[loan.debtTokenSymbol] || 0
      if (colPrice === 0 || debtPrice === 0) return false
      const colValueUsd = loan.collateralAmountUi * colPrice
      const debtValueUsd = loan.debtAmountUi * debtPrice
      const ratio = debtValueUsd > 0 ? (colValueUsd / debtValueUsd) * 100 : 0
      return ratio < MIN_RATIO
    })

    let rescinded = 0
    let skipped = 0
    const errors: string[] = []
    const redis = getRedis()

    for (const loan of undercollateralized) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break

      const dedupKey = `${RESCIND_DEDUP_PREFIX}${loan.publicKey}`
      if (await redis.get(dedupKey)) {
        skipped++
        continue
      }

      try {
        const collateralFeedId = MINT_TO_FEED_ID[loan.collateralMint]
        const debtFeedId = MINT_TO_FEED_ID[loan.debtMint]
        if (!collateralFeedId || !debtFeedId) {
          errors.push(`${loan.publicKey}: no price feed for mints`)
          await redis.set(dedupKey, "no-feed", { ex: RESCIND_DEDUP_TTL })
          continue
        }

        // Fetch & post Pyth prices
        console.log(`[stale-offers] ${loan.publicKey}: fetching Hermes prices...`)
        const priceUpdateData = await fetchHermesUpdates([collateralFeedId, debtFeedId])
        if (!priceUpdateData.length) {
          errors.push(`${loan.publicKey}: empty Hermes response`)
          continue
        }

        const pythResult = await buildPostPriceUpdateInstructions(
          connection,
          botKeypair,
          priceUpdateData,
        )

        const colPriceAcct = pythResult.priceUpdateAccounts[collateralFeedId]
        const debtPriceAcct = pythResult.priceUpdateAccounts[debtFeedId]
        if (!colPriceAcct || !debtPriceAcct) {
          errors.push(`${loan.publicKey}: price update accounts not created`)
          continue
        }

        // Build rescind instruction
        const { instruction: rescindIx, preIxs } = await buildRescindUndercollateralizedOfferIx(
          connection,
          program,
          botKeypair.publicKey,
          loan,
          colPriceAcct,
          debtPriceAcct,
        )

        const computeBudgetIxs = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        ]

        // TX1+TX2: Post price updates
        for (let i = 0; i < pythResult.postInstructions.length; i++) {
          const priceTx = new Transaction()
          priceTx.add(...computeBudgetIxs)
          priceTx.add(pythResult.postInstructions[i])
          const { blockhash } = await connection.getLatestBlockhash("confirmed")
          priceTx.recentBlockhash = blockhash
          priceTx.feePayer = botKeypair.publicKey
          priceTx.sign(botKeypair, pythResult.ephemeralSigners[i])
          const sig = await connection.sendRawTransaction(priceTx.serialize())
          await connection.confirmTransaction(sig, "confirmed")
          console.log(`[stale-offers] ${loan.publicKey}: price tx ${i + 1} confirmed: ${sig}`)
        }

        // TX3: rescind + cleanup price accounts
        const rescindTx = new Transaction()
        rescindTx.add(...computeBudgetIxs)
        for (const ix of preIxs) rescindTx.add(ix)
        rescindTx.add(rescindIx)
        for (const ix of pythResult.closeInstructions) rescindTx.add(ix)
        const { blockhash } = await connection.getLatestBlockhash("confirmed")
        rescindTx.recentBlockhash = blockhash
        rescindTx.feePayer = botKeypair.publicKey
        rescindTx.sign(botKeypair)

        const sig = await connection.sendRawTransaction(rescindTx.serialize())
        await connection.confirmTransaction(sig, "confirmed")
        console.log(`[stale-offers] ${loan.publicKey}: rescind tx confirmed: ${sig}`)

        await redis.set(dedupKey, "success", { ex: RESCIND_DEDUP_TTL })
        rescinded++
      } catch (err: any) {
        const stack = err.stack?.split("\n").slice(0, 8).join(" | ") || ""
        errors.push(`${loan.publicKey}: ${err.message} [${stack}]`)
        await redis.set(dedupKey, "error", { ex: RESCIND_DEDUP_TTL }).catch(() => {})
      }
    }

    return NextResponse.json({
      message: "Stale offers cron completed",
      bot: botKeypair.publicKey.toBase58(),
      pendingOffers: pendingOffers.length,
      undercollateralized: undercollateralized.length,
      rescinded,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      durationMs: Date.now() - startTime,
    })
  } catch (err: any) {
    console.error("Stale offers cron error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
