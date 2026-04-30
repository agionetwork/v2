import { getRedis, isRedisConfigured } from "@/lib/agent/redis"

export interface PaymentReceipt {
  id: string
  wallet: string
  toolName: string
  amount: number
  token: string
  txSignature: string
  timestamp: string
  success: boolean
  error?: string
  verificationHash?: string
  settled?: boolean
}

const MAX_RECEIPTS = 500
const RECEIPT_TTL = 60 * 60 * 24 * 30 // 30 days

function receiptKey(wallet: string): string {
  return `mcp:receipts:${wallet}`
}

/**
 * Record a payment receipt for a tool call.
 * Stored as a capped list in Redis (max 500 per wallet).
 */
export async function recordReceipt(receipt: PaymentReceipt): Promise<void> {
  if (!isRedisConfigured()) return

  try {
    const redis = getRedis()
    const key = receiptKey(receipt.wallet)
    await redis.lpush(key, JSON.stringify(receipt))
    await redis.ltrim(key, 0, MAX_RECEIPTS - 1)
    await redis.expire(key, RECEIPT_TTL)
  } catch {
    // Best-effort — don't fail the tool call
  }
}

/**
 * Get payment receipts for a wallet with pagination.
 */
export async function getReceipts(
  wallet: string,
  page = 1,
  pageSize = 20,
): Promise<{ receipts: PaymentReceipt[]; total: number; page: number; pageSize: number }> {
  if (!isRedisConfigured()) {
    return { receipts: [], total: 0, page, pageSize }
  }

  try {
    const redis = getRedis()
    const key = receiptKey(wallet)
    const total = await redis.llen(key)
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1
    const raw = await redis.lrange(key, start, end)

    const receipts = raw
      .map((r) => {
        try {
          return JSON.parse(r as string) as PaymentReceipt
        } catch {
          return null
        }
      })
      .filter((r): r is PaymentReceipt => r !== null)

    return { receipts, total, page, pageSize }
  } catch {
    return { receipts: [], total: 0, page, pageSize }
  }
}
