import { Redis } from "@upstash/redis"
import {
  type AgentConfig,
  type AgentAction,
  DEFAULT_AGENT_CONFIG,
  MAX_HISTORY_ENTRIES,
  agentKey,
  AGENTS_ACTIVE_SET,
} from "./types"

let _redis: Redis | null = null

export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

export function getRedis(): Redis {
  if (!isRedisConfigured()) {
    throw new Error("Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.")
  }
  if (!_redis) {
    _redis = Redis.fromEnv()
  }
  return _redis
}

// --- Agent CRUD ---

export async function getAgentPrivyWalletId(userWallet: string): Promise<string | null> {
  return getRedis().get<string>(agentKey(userWallet, "privyWalletId"))
}

export async function getAgentPublicKey(userWallet: string): Promise<string | null> {
  return getRedis().get<string>(agentKey(userWallet, "publicKey"))
}

export async function setAgentWallet(
  userWallet: string,
  privyWalletId: string,
  publicKey: string,
): Promise<void> {
  const redis = getRedis()
  await Promise.all([
    redis.set(agentKey(userWallet, "privyWalletId"), privyWalletId),
    redis.set(agentKey(userWallet, "publicKey"), publicKey),
    // Reverse mapping: agent public key → owner wallet (for self-lending checks)
    redis.set(`agent:reverse:${publicKey}`, userWallet),
    // Persistent set of all owners (survives deactivation, used by resolveOwner fallback)
    redis.sadd("agents:all", userWallet),
  ])
}

/**
 * Reverse lookup: given an agent's on-chain public key, find the owner wallet.
 * Used by self-lending checks to block same-owner loans.
 */
export async function getOwnerByAgentPublicKey(agentPublicKey: string): Promise<string | null> {
  return getRedis().get<string>(`agent:reverse:${agentPublicKey}`)
}

export async function hasAgent(userWallet: string): Promise<boolean> {
  const walletId = await getAgentPrivyWalletId(userWallet)
  return walletId !== null
}

// --- API Key (devnet free mode auth) ---

export async function getAgentApiKey(userWallet: string): Promise<string | null> {
  return getRedis().get<string>(agentKey(userWallet, "apiKey"))
}

export async function setAgentApiKey(userWallet: string, apiKey: string): Promise<void> {
  await getRedis().set(agentKey(userWallet, "apiKey"), apiKey)
}

export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let key = "agio_"
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

// --- Config ---

export async function getAgentConfig(userWallet: string): Promise<AgentConfig | null> {
  const raw = await getRedis().get<Partial<AgentConfig>>(agentKey(userWallet, "config"))
  if (!raw) return null
  // Merge with defaults to handle missing fields from older configs
  return { ...DEFAULT_AGENT_CONFIG, ...raw }
}

export async function setAgentConfig(userWallet: string, config: AgentConfig): Promise<void> {
  await getRedis().set(agentKey(userWallet, "config"), config)
}

export async function createDefaultConfig(userWallet: string): Promise<AgentConfig> {
  const config: AgentConfig = {
    ...DEFAULT_AGENT_CONFIG,
    createdAt: new Date().toISOString(),
  }
  await setAgentConfig(userWallet, config)
  return config
}
// --- Active agents set ---

export async function getActiveAgents(): Promise<string[]> {
  const members = await getRedis().smembers(AGENTS_ACTIVE_SET)
  return members
}

export async function addActiveAgent(userWallet: string): Promise<void> {
  await getRedis().sadd(AGENTS_ACTIVE_SET, userWallet)
}

export async function removeActiveAgent(userWallet: string): Promise<void> {
  await getRedis().srem(AGENTS_ACTIVE_SET, userWallet)
}

// --- History ---

export async function getAgentHistory(
  userWallet: string,
  page = 1,
  pageSize = 20,
): Promise<{ actions: AgentAction[]; total: number }> {
  const all = (await getRedis().get<AgentAction[]>(agentKey(userWallet, "history"))) || []
  const total = all.length
  const start = (page - 1) * pageSize
  const actions = all.slice(start, start + pageSize)
  return { actions, total }
}

export async function appendAgentAction(userWallet: string, action: AgentAction): Promise<void> {
  const redis = getRedis()
  const key = agentKey(userWallet, "history")
  const all = (await redis.get<AgentAction[]>(key)) || []
  all.unshift(action) // newest first
  if (all.length > MAX_HISTORY_ENTRIES) {
    all.length = MAX_HISTORY_ENTRIES
  }
  await redis.set(key, all)
}

// --- Airdrop cooldown ---

const AIRDROP_COOLDOWN_MS = 10 * 60 * 60 * 1000 // 10 hours

export async function getLastAirdropTime(userWallet: string): Promise<number> {
  const ts = await getRedis().get<number>(agentKey(userWallet, "lastAirdrop"))
  return ts || 0
}

export async function setLastAirdropTime(userWallet: string): Promise<void> {
  await getRedis().set(agentKey(userWallet, "lastAirdrop"), Date.now())
}

export function isAirdropCooldownExpired(lastAirdropTime: number): boolean {
  return Date.now() - lastAirdropTime >= AIRDROP_COOLDOWN_MS
}

// --- Loan expiry warning deduplication (tiered: 48h, 24h, 1h) ---

const LOAN_WARNED_PREFIX = "loan:warned:"
const WARN_TTL_SECONDS = 48 * 60 * 60 // 48 hours

export async function isLoanWarned(loanPublicKey: string): Promise<boolean> {
  return (await getRedis().get(`${LOAN_WARNED_PREFIX}${loanPublicKey}`)) !== null
}

export async function markLoanWarned(loanPublicKey: string): Promise<void> {
  await getRedis().set(`${LOAN_WARNED_PREFIX}${loanPublicKey}`, "1", { ex: WARN_TTL_SECONDS })
}

/** Tiered warning: each tier (48h, 24h, 1h) has its own dedup key. */
export async function isLoanWarnedTier(loanPublicKey: string, tier: string): Promise<boolean> {
  return (await getRedis().get(`${LOAN_WARNED_PREFIX}${loanPublicKey}:${tier}`)) !== null
}

export async function markLoanWarnedTier(
  loanPublicKey: string,
  tier: string,
  ttlSeconds: number,
): Promise<void> {
  await getRedis().set(`${LOAN_WARNED_PREFIX}${loanPublicKey}:${tier}`, "1", { ex: ttlSeconds })
}

// --- Collateral ratio warning deduplication ---

const COLLATERAL_WARNED_PREFIX = "loan:collateral-warned:"
const COLLATERAL_WARN_TTL = 6 * 60 * 60 // 6 hours — re-warn if still low

export async function isCollateralWarned(loanPublicKey: string): Promise<boolean> {
  return (await getRedis().get(`${COLLATERAL_WARNED_PREFIX}${loanPublicKey}`)) !== null
}

export async function markCollateralWarned(loanPublicKey: string): Promise<void> {
  await getRedis().set(`${COLLATERAL_WARNED_PREFIX}${loanPublicKey}`, "1", { ex: COLLATERAL_WARN_TTL })
}
