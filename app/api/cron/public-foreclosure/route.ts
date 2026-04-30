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
import { PYTH_FEED_IDS } from "@/lib/token-prices"
import {
  fetchHermesUpdates,
  buildPostPriceUpdateInstructions,
} from "@/lib/pyth-poster"
import { buildForecloseLoanV2Ix } from "@/lib/agent/transaction-builder"
import { notifyLoanForeclosed } from "@/lib/dialect"
import { getOwnerByAgentPublicKey, getRedis } from "@/lib/agent/redis"
import IDL from "@/lib/idl/agio.json"

const FORECLOSURE_DEDUP_PREFIX = "foreclosure:attempted:"
const FORECLOSURE_DEDUP_TTL = 3600 // 1 hour — prevents retry storm

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
})

// Mint address → Pyth feed ID (hex, no 0x prefix)
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
  const MAX_RUNTIME_MS = 50_000 // 50s guard (Vercel limit = 60s)

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

    // Fetch all active loans
    const allAccounts = await (program.account as any).loan.all()
    const loans = parseLoanAccounts(allAccounts)
    const now = Math.floor(Date.now() / 1000)

    // Filter: active + expired + has lender
    const expiredLoans = loans.filter((l) => {
      if (l.status !== LoanStatus.Accepted) return false
      if (!l.start || !l.lender) return false
      return l.start + l.duration <= now
    })

    let foreclosed = 0
    let skipped = 0
    const errors: string[] = []
    const redis = getRedis()

    for (const loan of expiredLoans) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) break

      const dedupKey = `${FORECLOSURE_DEDUP_PREFIX}${loan.publicKey}`
      if (await redis.get(dedupKey)) {
        skipped++
        continue
      }

      try {
        // Resolve Pyth feed IDs for this loan's collateral + debt mints
        const collateralFeedId = MINT_TO_FEED_ID[loan.collateralMint]
        const debtFeedId = MINT_TO_FEED_ID[loan.debtMint]
        if (!collateralFeedId || !debtFeedId) {
          errors.push(`${loan.publicKey}: no price feed for mints (col=${loan.collateralMint} debt=${loan.debtMint})`)
          await redis.set(dedupKey, "no-feed", { ex: FORECLOSURE_DEDUP_TTL })
          continue
        }

        // Fetch price update data from Pyth Hermes
        console.log(`[foreclosure] ${loan.publicKey}: fetching Hermes for col=${collateralFeedId} debt=${debtFeedId}`)
        const priceUpdateData = await fetchHermesUpdates([collateralFeedId, debtFeedId])
        if (!priceUpdateData.length) {
          errors.push(`${loan.publicKey}: empty Hermes response`)
          continue
        }

        // Build Pyth price posting instructions (lightweight, no Anchor Program)
        console.log(`[foreclosure] ${loan.publicKey}: building Pyth instructions...`)
        const pythResult = await buildPostPriceUpdateInstructions(
          connection,
          botKeypair,
          priceUpdateData,
        )
        console.log(`[foreclosure] ${loan.publicKey}: Pyth OK, feeds: ${Object.keys(pythResult.priceUpdateAccounts).join(', ')}`)

        // Resolve price update account addresses for this loan's feeds
        const colPriceAcct = pythResult.priceUpdateAccounts[collateralFeedId]
        const debtPriceAcct = pythResult.priceUpdateAccounts[debtFeedId]
        if (!colPriceAcct || !debtPriceAcct) {
          errors.push(`${loan.publicKey}: price update accounts not created for feeds`)
          continue
        }

        // Build the foreclose_loan_v2 instruction
        console.log(`[foreclosure] ${loan.publicKey}: building foreclose_loan_v2 ix...`)
        const { instruction: foreclosIx, preIxs } = await buildForecloseLoanV2Ix(
          connection,
          program,
          botKeypair.publicKey,
          loan,
          colPriceAcct,
          debtPriceAcct,
        )
        console.log(`[foreclosure] ${loan.publicKey}: foreclose ix built OK`)

        // Split into separate transactions (each post_update_atomic carries ~1KB VAA,
        // exceeding Solana's 1232-byte tx limit if combined)
        const computeBudgetIxs = [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        ]

        // TX1+TX2: Post each price update in its own transaction
        for (let i = 0; i < pythResult.postInstructions.length; i++) {
          const priceTx = new Transaction()
          priceTx.add(...computeBudgetIxs)
          priceTx.add(pythResult.postInstructions[i])
          const { blockhash: priceHash } = await connection.getLatestBlockhash("confirmed")
          priceTx.recentBlockhash = priceHash
          priceTx.feePayer = botKeypair.publicKey
          priceTx.sign(botKeypair, pythResult.ephemeralSigners[i])
          const priceSig = await connection.sendRawTransaction(priceTx.serialize())
          await connection.confirmTransaction(priceSig, "confirmed")
          console.log(`[foreclosure] ${loan.publicKey}: price tx ${i + 1}/${pythResult.postInstructions.length} confirmed: ${priceSig}`)
        }

        // TX3: foreclose + reclaim rent
        const forecloseTx = new Transaction()
        forecloseTx.add(...computeBudgetIxs)
        for (const ix of preIxs) forecloseTx.add(ix)
        forecloseTx.add(foreclosIx)
        for (const ix of pythResult.closeInstructions) forecloseTx.add(ix)
        const { blockhash } = await connection.getLatestBlockhash("confirmed")
        forecloseTx.recentBlockhash = blockhash
        forecloseTx.feePayer = botKeypair.publicKey
        forecloseTx.sign(botKeypair)

        const sig = await connection.sendRawTransaction(forecloseTx.serialize())
        await connection.confirmTransaction(sig, "confirmed")
        console.log(`[foreclosure] ${loan.publicKey}: foreclose tx confirmed: ${sig}`)

        await redis.set(dedupKey, "success", { ex: FORECLOSURE_DEDUP_TTL })

        // Notify both parties via Dialect (fire-and-forget)
        const details = { debtToken: loan.debtTokenSymbol, amount: loan.debtAmountUi }
        const lenderOwner = loan.lender
          ? (await getOwnerByAgentPublicKey(loan.lender)) || loan.lender
          : null
        const borrowerOwner = loan.borrower
          ? (await getOwnerByAgentPublicKey(loan.borrower)) || loan.borrower
          : null
        if (lenderOwner) notifyLoanForeclosed(lenderOwner, details).catch(() => {})
        if (borrowerOwner) notifyLoanForeclosed(borrowerOwner, details).catch(() => {})

        foreclosed++
      } catch (err: any) {
        const stack = err.stack?.split('\n').slice(0, 8).join(' | ') || ''
        errors.push(`${loan.publicKey}: ${err.message} [${stack}]`)
        await redis.set(dedupKey, "error", { ex: FORECLOSURE_DEDUP_TTL }).catch(() => {})
      }
    }

    return NextResponse.json({
      message: "Public foreclosure cron completed",
      bot: botKeypair.publicKey.toBase58(),
      expiredLoans: expiredLoans.length,
      foreclosed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      durationMs: Date.now() - startTime,
    })
  } catch (err: any) {
    console.error("Public foreclosure cron error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
