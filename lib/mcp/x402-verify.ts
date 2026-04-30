import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js"
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token"
import { createHash } from "crypto"
import { SOLANA_CONFIG } from "@/config/solana"
import { TOKEN_MINTS, TOKEN_DECIMALS } from "@/lib/token-mints"
import { getRedis, isRedisConfigured } from "@/lib/agent/redis"

// Agio Treasury wallet that receives all x402 payments (lazy init — throws if not configured)
let _treasuryWallet: PublicKey | null = null
function getTreasuryWallet(): PublicKey {
  if (!_treasuryWallet) {
    const addr = process.env.X402_TREASURY_WALLET
    if (!addr) {
      throw new Error(
        "X402_TREASURY_WALLET environment variable is not set. " +
        "Payments cannot be processed without a treasury wallet.",
      )
    }
    _treasuryWallet = new PublicKey(addr)
  }
  return _treasuryWallet
}

const USDC_MINT = TOKEN_MINTS.USDC
const EURC_MINT = TOKEN_MINTS.EURC
const SOL_MINT = TOKEN_MINTS.SOL

// CAIP-2 network identifiers (x402 v2 spec)
const SOLANA_MAINNET_CAIP2 = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
const SOLANA_DEVNET_CAIP2 = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"

export function getSolanaNetworkCaip2(): string {
  return SOLANA_CONFIG.RPC_URL.includes("devnet")
    ? SOLANA_DEVNET_CAIP2
    : SOLANA_MAINNET_CAIP2
}

// --- Legacy format (backward compat) ---

export interface PaymentOption {
  token: string
  mint: string
  recipientTokenAccount: string
  amountRaw: number
  amountUi: number
  decimals: number
  type: "spl" | "native"
}

// --- x402 v2 spec format ---

export interface X402PaymentRequirements {
  scheme: "exact"
  network: string
  asset: string
  amount: string
  payTo: string
  maxTimeoutSeconds: number
  extra: Record<string, unknown>
}

export interface PaymentRequirement {
  x402Version: 2
  scheme: "exact"
  network: string
  recipient: string
  description: string
  // x402 v2 standard format
  accepts: X402PaymentRequirements[]
  // Legacy USDC fields (backward compat)
  recipientTokenAccount: string
  mint: string
  amountLamports: number
  amountUSDC: number
  // Legacy multi-token options (backward compat)
  acceptedPayments: PaymentOption[]
}

export interface VerificationResult {
  valid: boolean
  payerWallet: string
  txSignature: string
  amountUsdc: number
  paymentToken: string
  verificationHash: string
  error?: string
}

export interface SettlementResult {
  success: boolean
  txSignature: string
  network: string
  error?: string
}

/**
 * Get a Jupiter quote to convert between tokens.
 * Used to calculate equivalent EURC/SOL amounts for a given USDC price.
 * Includes in-memory cache (5min TTL), retry (1x), and fetch timeout (10s).
 */
const jupiterCache = new Map<string, { value: number; expiry: number }>()
const JUPITER_CACHE_TTL = 5 * 60 * 1000
const JUPITER_TIMEOUT = 10_000

async function getJupiterPrice(
  inputMint: string,
  outputMint: string,
  amount: number,
): Promise<number> {
  const cacheKey = `${inputMint}:${outputMint}:${amount}`
  const cached = jupiterCache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) return cached.value

  const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100`

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), JUPITER_TIMEOUT)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) {
        if (attempt === 0) continue
        break
      }
      const data = await res.json()
      const value = parseInt(data.outAmount || "0", 10)
      if (value > 0) {
        jupiterCache.set(cacheKey, { value, expiry: Date.now() + JUPITER_CACHE_TTL })
      }
      return value
    } catch {
      if (attempt === 0) continue
    }
  }

  // Return stale cached value as fallback, or 0 if no cache
  return cached?.value ?? 0
}

/**
 * Build payment requirement instructions for a tool that requires payment.
 * Returns both x402 v2 `accepts[]` format and legacy `acceptedPayments[]`.
 */
export async function createPaymentRequirement(
  amountUsdc: number,
  description: string,
): Promise<PaymentRequirement> {
  const network = getSolanaNetworkCaip2()
  const treasury = getTreasuryWallet()
  const usdcAta = getAssociatedTokenAddressSync(USDC_MINT, treasury)
  const eurcAta = getAssociatedTokenAddressSync(EURC_MINT, treasury)
  const usdcRaw = Math.round(amountUsdc * 1_000_000)
  const payTo = treasury.toBase58()

  // Build legacy options
  const options: PaymentOption[] = [
    {
      token: "USDC",
      mint: USDC_MINT.toBase58(),
      recipientTokenAccount: usdcAta.toBase58(),
      amountRaw: usdcRaw,
      amountUi: amountUsdc,
      decimals: 6,
      type: "spl",
    },
  ]

  // Build x402 v2 accepts
  const accepts: X402PaymentRequirements[] = [
    {
      scheme: "exact",
      network,
      asset: USDC_MINT.toBase58(),
      amount: String(usdcRaw),
      payTo,
      maxTimeoutSeconds: 300,
      extra: {},
    },
  ]

  // Try to get EURC equivalent via Jupiter
  const eurcOut = await getJupiterPrice(USDC_MINT.toBase58(), EURC_MINT.toBase58(), usdcRaw)
  if (eurcOut > 0) {
    const eurcRequired = Math.ceil(eurcOut * 1.02) // 2% buffer
    options.push({
      token: "EURC",
      mint: EURC_MINT.toBase58(),
      recipientTokenAccount: eurcAta.toBase58(),
      amountRaw: eurcRequired,
      amountUi: eurcRequired / 1_000_000,
      decimals: 6,
      type: "spl",
    })
    accepts.push({
      scheme: "exact",
      network,
      asset: EURC_MINT.toBase58(),
      amount: String(eurcRequired),
      payTo,
      maxTimeoutSeconds: 300,
      extra: {},
    })
  }

  // Try to get SOL equivalent via Jupiter
  const solOut = await getJupiterPrice(USDC_MINT.toBase58(), SOL_MINT.toBase58(), usdcRaw)
  if (solOut > 0) {
    const solRequired = Math.ceil(solOut * 1.02) // 2% buffer
    options.push({
      token: "SOL",
      mint: SOL_MINT.toBase58(),
      recipientTokenAccount: payTo, // native SOL goes directly
      amountRaw: solRequired,
      amountUi: solRequired / 1e9,
      decimals: 9,
      type: "native",
    })
    accepts.push({
      scheme: "exact",
      network,
      asset: SOL_MINT.toBase58(),
      amount: String(solRequired),
      payTo,
      maxTimeoutSeconds: 300,
      extra: { native: true },
    })
  }

  return {
    x402Version: 2,
    scheme: "exact",
    network,
    recipient: payTo,
    description,
    // x402 v2 standard
    accepts,
    // Legacy USDC fields
    recipientTokenAccount: usdcAta.toBase58(),
    mint: USDC_MINT.toBase58(),
    amountLamports: usdcRaw,
    amountUSDC: amountUsdc,
    // Legacy multi-token
    acceptedPayments: options,
  }
}

// SPL Token Transfer instruction layout:
// byte 0: instruction type (3 = Transfer)
// bytes 1-8: amount (u64 little-endian)
const SPL_TRANSFER_INSTRUCTION = 3

function decodeSplTransferAmount(data: Buffer): bigint {
  if (data.length < 9 || data[0] !== SPL_TRANSFER_INSTRUCTION) {
    return BigInt(0)
  }
  return data.readBigUInt64LE(1)
}

/**
 * Detect which token was used for payment in a transaction.
 * Checks for SPL transfers to treasury ATAs (USDC/EURC) and
 * native SOL transfers to treasury wallet.
 */
function detectPayment(tx: Transaction): {
  token: string
  amount: bigint
  decimals: number
} {
  const treasury = getTreasuryWallet()
  const usdcAta = getAssociatedTokenAddressSync(USDC_MINT, treasury)
  const eurcAta = getAssociatedTokenAddressSync(EURC_MINT, treasury)

  let usdcTotal = BigInt(0)
  let eurcTotal = BigInt(0)
  let solTotal = BigInt(0)

  for (const ix of tx.instructions) {
    // SPL Token transfers
    if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
      const amount = decodeSplTransferAmount(ix.data as Buffer)
      if (amount === BigInt(0) || ix.keys.length < 2) continue

      const destination = ix.keys[1].pubkey
      if (destination.equals(usdcAta)) {
        usdcTotal += amount
      } else if (destination.equals(eurcAta)) {
        eurcTotal += amount
      }
    }

    // Native SOL transfer (SystemProgram.transfer)
    if (ix.programId.equals(SystemProgram.programId)) {
      // SystemProgram.transfer instruction layout: type (4 bytes) + lamports (8 bytes)
      if (ix.data.length >= 12 && ix.data.readUInt32LE(0) === 2) {
        if (ix.keys.length >= 2 && ix.keys[1].pubkey.equals(getTreasuryWallet())) {
          solTotal += ix.data.readBigUInt64LE(4)
        }
      }
    }
  }

  // Return the token with the highest value (prefer USDC > EURC > SOL)
  if (usdcTotal > BigInt(0)) return { token: "USDC", amount: usdcTotal, decimals: 6 }
  if (eurcTotal > BigInt(0)) return { token: "EURC", amount: eurcTotal, decimals: 6 }
  if (solTotal > BigInt(0)) return { token: "SOL", amount: solTotal, decimals: 9 }

  return { token: "unknown", amount: BigInt(0), decimals: 0 }
}

/**
 * Convert a token amount to its USDC equivalent using Jupiter quotes.
 */
async function convertToUsdc(token: string, rawAmount: bigint): Promise<number> {
  if (token === "USDC") return Number(rawAmount) / 1e6

  const mint = token === "EURC" ? EURC_MINT.toBase58() : SOL_MINT.toBase58()
  const usdcOut = await getJupiterPrice(mint, USDC_MINT.toBase58(), Number(rawAmount))
  return usdcOut / 1e6
}

/**
 * Verify an x402 payment proof WITHOUT broadcasting.
 *
 * Deferred settlement pattern (x402 v2):
 * 1. verify — local validation only (this function)
 * 2. execute tool
 * 3. settle — broadcast + confirm (settleX402Payment)
 *
 * This ensures users are NOT charged if the tool execution fails.
 */
export async function verifyX402Payment(
  paymentProof: string,
  requiredAmountUsdc: number,
): Promise<VerificationResult> {
  const fail = (error: string): VerificationResult => ({
    valid: false,
    payerWallet: "",
    txSignature: "",
    amountUsdc: 0,
    paymentToken: "",
    verificationHash: "",
    error,
  })

  try {
    // 1. Decode and deserialize the transaction
    const buffer = Buffer.from(paymentProof, "base64")
    const tx = Transaction.from(buffer)

    if (!tx.feePayer) {
      return fail("Transaction has no fee payer")
    }

    // 2. CRITICAL: Verify the fee payer has actually signed this transaction.
    // Without this, an attacker can submit unsigned txs that pass all other checks,
    // get free tool execution via deferred settlement, and the settle phase fails
    // because the RPC rejects unsigned transactions.
    if (!tx.verifySignatures()) {
      return fail(
        "Transaction signature verification failed. The fee payer must sign the transaction.",
      )
    }

    const payerWallet = tx.feePayer.toBase58()

    // 3. Deterministic hash of the full transaction for replay protection and audit trail
    const verificationHash = createHash("sha256").update(buffer).digest("hex")

    // 4. Detect which token was used and how much was transferred
    const { token, amount, decimals } = detectPayment(tx)

    if (token === "unknown" || amount === BigInt(0)) {
      return fail(
        "No valid payment detected. Transaction must transfer USDC, EURC, or SOL to the Agio treasury.",
      )
    }

    // 5. Convert to USDC equivalent and verify amount
    const usdcEquivalent = await convertToUsdc(token, amount)

    // Allow 3% slippage for non-USDC payments (price movement between quote and verification)
    const slippageFactor = token === "USDC" ? 1.0 : 0.97
    if (usdcEquivalent < requiredAmountUsdc * slippageFactor) {
      const uiAmount = Number(amount) / 10 ** decimals
      return fail(
        `Insufficient payment: got ${uiAmount} ${token} (~${usdcEquivalent.toFixed(4)} USDC), ` +
        `required ${requiredAmountUsdc} USDC`,
      )
    }

    // 6. Check for replay attacks using SHA-256 hash of the full transaction buffer
    if (isRedisConfigured()) {
      const replayKey = `mcp:tx:${verificationHash}`
      const redis = getRedis()
      const existing = await redis.get(replayKey)
      if (existing) {
        return fail("Payment proof already used (replay attack)")
      }
      // Reserve now to prevent concurrent replays.
      // If settle fails later, the key expires after 24h and can be reused.
      await redis.set(replayKey, "pending", { ex: 86400 })
    } else {
      if (process.env.NODE_ENV === "production") {
        return fail(
          "Redis is not configured. Replay protection is required in production. " +
          "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
        )
      }
      console.warn(
        "[x402-verify] Redis not configured — replay protection DISABLED (dev only).",
      )
    }

    // NOTE: We do NOT broadcast the transaction here.
    // Settlement is deferred until after successful tool execution.
    return {
      valid: true,
      payerWallet,
      txSignature: "", // Will be filled by settleX402Payment
      amountUsdc: usdcEquivalent,
      paymentToken: token,
      verificationHash,
    }
  } catch (err: any) {
    return fail(err.message || "Payment verification failed")
  }
}

/**
 * Settle (broadcast + confirm) a previously verified x402 payment.
 *
 * Called ONLY after the tool executes successfully.
 * This is the second half of the deferred settlement pattern.
 */
export async function settleX402Payment(
  paymentProof: string,
): Promise<SettlementResult> {
  try {
    const buffer = Buffer.from(paymentProof, "base64")
    const connection = new Connection(SOLANA_CONFIG.RPC_URL, "confirmed")

    const txSignature = await connection.sendRawTransaction(buffer, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    })

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed")
    await connection.confirmTransaction(
      { signature: txSignature, blockhash, lastValidBlockHeight },
      "confirmed",
    )

    // Mark as settled in Redis (using same SHA-256 key as verifyX402Payment)
    if (isRedisConfigured()) {
      const txHash = createHash("sha256").update(buffer).digest("hex")
      await getRedis().set(`mcp:tx:${txHash}`, "settled", { ex: 86400 })
    }

    return {
      success: true,
      txSignature,
      network: getSolanaNetworkCaip2(),
    }
  } catch (err: any) {
    return {
      success: false,
      txSignature: "",
      network: getSolanaNetworkCaip2(),
      error: err.message || "Settlement failed",
    }
  }
}

/**
 * Rate limiting for MCP tool calls.
 * Returns true if the request should be allowed.
 */
export async function checkRateLimit(
  wallet: string,
  isPaid: boolean,
): Promise<boolean> {
  if (!isRedisConfigured()) {
    if (process.env.NODE_ENV === "production") return false
    return true
  }

  try {
    const redis = getRedis()
    const key = isPaid ? `mcp:rate:paid:${wallet}` : `mcp:rate:free:${wallet}`
    const limit = isPaid ? 10 : 60 // per minute
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, 60)
    }
    return count <= limit
  } catch {
    return true // allow on error
  }
}
