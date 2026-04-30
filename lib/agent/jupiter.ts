import { PublicKey } from "@solana/web3.js"
import { TOKEN_MINTS } from "@/lib/token-mints"
import { SOLANA_CONFIG } from "@/config/solana"
import { getAgentPublicKey } from "./redis"
import { signAndSendTransaction } from "./privy"
import { markAsJupiterSwap } from "./tx-validator"

const JUPITER_API_BASE = "https://quote-api.jup.ag/v6"

// Known token symbols to mint addresses — for convenience so callers
// can pass "USDC" instead of the full mint address.
const SYMBOL_TO_MINT: Record<string, string> = Object.fromEntries(
  Object.entries(TOKEN_MINTS).map(([symbol, pk]) => [symbol, pk.toBase58()]),
)

/**
 * Resolve a token identifier (symbol or mint address) to a mint address string.
 */
export function resolveTokenMint(tokenIdOrSymbol: string): string {
  const upper = tokenIdOrSymbol.toUpperCase()
  if (SYMBOL_TO_MINT[upper]) return SYMBOL_TO_MINT[upper]
  // Assume it's a mint address — validate it's a valid PublicKey
  try {
    new PublicKey(tokenIdOrSymbol)
    return tokenIdOrSymbol
  } catch {
    throw new Error(`Unknown token: ${tokenIdOrSymbol}. Use a symbol (USDC, EURC, SOL) or a valid Solana mint address.`)
  }
}

export interface SwapQuote {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  priceImpactPct: string
  routePlan: any[]
  // Full quote response for passing to swap endpoint
  raw: any
}

/**
 * Get a swap quote from Jupiter v6 API.
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps = 50,
): Promise<SwapQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: String(slippageBps),
  })

  const res = await fetch(`${JUPITER_API_BASE}/quote?${params}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Jupiter quote failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return {
    inputMint: data.inputMint,
    outputMint: data.outputMint,
    inAmount: data.inAmount,
    outAmount: data.outAmount,
    priceImpactPct: data.priceImpactPct,
    routePlan: data.routePlan || [],
    raw: data,
  }
}

/**
 * Build a swap transaction from a Jupiter quote.
 * Returns a base64-encoded serialized transaction.
 */
export async function buildSwapTx(
  userPublicKey: string,
  quoteResponse: any,
): Promise<string> {
  const res = await fetch(`${JUPITER_API_BASE}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Jupiter swap failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.swapTransaction // base64 encoded
}

export interface SwapResult {
  txSignature: string
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  priceImpactPct: string
}

/**
 * Execute a full swap: quote → build tx → sign via Privy → broadcast.
 *
 * @param ownerWallet The owner wallet address (used to look up agent Privy wallet)
 * @param inputToken  Token symbol (USDC, EURC, SOL) or mint address
 * @param outputToken Token symbol or mint address
 * @param amount      Raw amount in smallest units (lamports for SOL, token units for SPL)
 * @param slippageBps Slippage tolerance in basis points (default 50 = 0.5%)
 */
function isDevnet(): boolean {
  return (
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet" ||
    !!process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet")
  )
}

export async function executeSwap(
  ownerWallet: string,
  inputToken: string,
  outputToken: string,
  amount: number,
  slippageBps = 50,
): Promise<SwapResult> {
  // Jupiter Aggregator is not available on devnet
  if (isDevnet()) {
    throw new Error(
      "Token swap via Jupiter is not available on Solana devnet. " +
      "This feature works on mainnet only. " +
      "On devnet, use the devnet-token-faucet tool to get USDC/EURC directly.",
    )
  }

  const inputMint = resolveTokenMint(inputToken)
  const outputMint = resolveTokenMint(outputToken)

  if (inputMint === outputMint) {
    throw new Error("Input and output tokens must be different")
  }

  const agentPubkey = await getAgentPublicKey(ownerWallet)
  if (!agentPubkey) throw new Error("Agent not found. Create one first with create-agent.")

  // 1. Get quote
  let quote: SwapQuote
  try {
    quote = await getSwapQuote(inputMint, outputMint, amount, slippageBps)
  } catch (err: any) {
    const msg = err.message || "Unknown error"
    if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      throw new Error(
        "Failed to connect to Jupiter Aggregator API. The service may be temporarily unavailable. Please try again in a few minutes.",
      )
    }
    throw new Error(`Jupiter quote failed: ${msg}`)
  }

  // 2. Build swap transaction
  let serializedTx: string
  try {
    serializedTx = await buildSwapTx(agentPubkey, quote.raw)
  } catch (err: any) {
    throw new Error(`Failed to build swap transaction: ${err.message || "Unknown error"}`)
  }

  // 3. Sign and send via Privy
  // Jupiter txs contain DEX program IDs outside our normal allowlist.
  // Mark this specific tx as Jupiter-approved so the tx-validator skips
  // strict program checks for it only. The marker is consumed on use.
  markAsJupiterSwap(serializedTx)
  const txSignature = await signAndSendTransaction(ownerWallet, serializedTx)

  return {
    txSignature,
    inputMint,
    outputMint,
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
    priceImpactPct: quote.priceImpactPct,
  }
}
