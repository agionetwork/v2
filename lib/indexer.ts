import { createConnection, createReadonlyProgram } from "@/lib/program"
import { parseLoanAccounts, LoanStatus, type ParsedLoan } from "@/lib/loan-utils"
import { getRedis, getOwnerByAgentPublicKey, isRedisConfigured } from "@/lib/agent/redis"
import {
  findOrCreateProfile,
  updateProfile,
  searchProfiles,
  postLoanActivity,
} from "@/lib/tapestry-server"

// Redis key patterns
const INDEXER_PREFIX = "indexer:"
const loanStatusKey = (loanPk: string, status: number) =>
  `${INDEXER_PREFIX}loan:${loanPk}:${status}`
const KNOWN_WALLET_SET = `${INDEXER_PREFIX}known-wallets`
const walletProfileKey = (wallet: string) =>
  `${INDEXER_PREFIX}wallet-profile:${wallet}`

// Status → activity event mapping
const STATUS_EVENT_MAP: Record<number, "created" | "accepted" | "repaid" | "foreclosed"> = {
  [LoanStatus.Pending]: "created",
  [LoanStatus.Accepted]: "accepted",
  [LoanStatus.Repaid]: "repaid",
  [LoanStatus.Foreclosed]: "foreclosed",
}

// Rate guards per cron run
const MAX_PROFILE_CREATES_PER_RUN = 10
const MAX_ACTIVITY_POSTS_PER_RUN = 20

export interface IndexerResult {
  totalLoans: number
  walletsScanned: number
  profilesCreated: number
  profilesSkipped: number
  activitiesPosted: number
  activitiesSkipped: number
  errors: string[]
  durationMs: number
}

/**
 * Resolve a wallet to its owner if it's an agent wallet, otherwise return as-is.
 */
async function resolveToOwnerWallet(wallet: string): Promise<string> {
  try {
    const owner = await getOwnerByAgentPublicKey(wallet)
    return owner || wallet
  } catch {
    return wallet
  }
}

/**
 * Get cached profile ID for a wallet, or look it up in Tapestry and cache it.
 */
async function resolveWalletToProfileId(wallet: string): Promise<string | null> {
  const redis = getRedis()

  const cached = await redis.get<string>(walletProfileKey(wallet))
  if (cached) return cached

  try {
    const result = await searchProfiles(wallet, 1, 0)
    if (result.profiles?.[0]?.profile?.id) {
      const profileId = result.profiles[0].profile.id
      await redis.set(walletProfileKey(wallet), profileId)
      return profileId
    }
  } catch {
    // Non-critical
  }
  return null
}

/**
 * Get the wallets that should receive an activity entry for a loan event.
 */
function getRelevantWallets(
  loan: ParsedLoan,
  event: "created" | "accepted" | "repaid" | "foreclosed"
): string[] {
  switch (event) {
    case "created":
      return [loan.lender, loan.borrower].filter(Boolean) as string[]
    case "accepted":
      return [loan.lender, loan.borrower].filter(Boolean) as string[]
    case "repaid":
      return loan.borrower ? [loan.borrower] : []
    case "foreclosed":
      return loan.lender ? [loan.lender] : []
    default:
      return []
  }
}

/**
 * Main indexer entry point. Scans all on-chain loans, creates shadow profiles
 * for unknown wallets, and posts activity feed entries for new loan status transitions.
 */
export async function runIndexer(startTime: number, maxRuntimeMs: number): Promise<IndexerResult> {
  const result: IndexerResult = {
    totalLoans: 0,
    walletsScanned: 0,
    profilesCreated: 0,
    profilesSkipped: 0,
    activitiesPosted: 0,
    activitiesSkipped: 0,
    errors: [],
    durationMs: 0,
  }

  // Fetch all on-chain loans
  const connection = createConnection()
  const program = createReadonlyProgram(connection)
  const allAccounts = await (program.account as any).loan.all()
  const loans = parseLoanAccounts(allAccounts)
  result.totalLoans = loans.length

  const redis = getRedis()

  // --- Phase A: Ensure profiles for all unique wallets ---
  const wallets = new Set<string>()
  for (const loan of loans) {
    if (loan.lender) wallets.add(loan.lender)
    if (loan.borrower) wallets.add(loan.borrower)
  }
  result.walletsScanned = wallets.size

  for (const wallet of wallets) {
    if (Date.now() - startTime > maxRuntimeMs) break
    if (result.profilesCreated >= MAX_PROFILE_CREATES_PER_RUN) break

    try {
      // Skip if already processed
      const isKnown = await redis.sismember(KNOWN_WALLET_SET, wallet)
      if (isKnown) {
        result.profilesSkipped++
        continue
      }

      // Skip agent wallets — owner should have the profile, not the agent
      const owner = await getOwnerByAgentPublicKey(wallet)
      if (owner) {
        await redis.sadd(KNOWN_WALLET_SET, wallet)
        result.profilesSkipped++
        continue
      }

      // Check if wallet already has a Tapestry profile
      const existing = await searchProfiles(wallet, 1, 0)
      if (existing.profiles?.length > 0 && existing.profiles[0]?.profile?.id) {
        await redis.set(walletProfileKey(wallet), existing.profiles[0].profile.id)
        await redis.sadd(KNOWN_WALLET_SET, wallet)
        result.profilesSkipped++
        continue
      }

      // Create shadow profile
      const profile = await findOrCreateProfile(wallet, wallet.slice(0, 8).toLowerCase())

      // Tag as indexer-created
      if (profile?.profile?.id) {
        try {
          await updateProfile(profile.profile.id, [
            { key: "source", value: "indexer" },
            { key: "autoCreated", value: "true" },
          ])
        } catch {
          // Tagging is non-critical
        }

        await redis.set(walletProfileKey(wallet), profile.profile.id)
      }

      await redis.sadd(KNOWN_WALLET_SET, wallet)
      result.profilesCreated++
    } catch (err: any) {
      result.errors.push(`profile:${wallet.slice(0, 8)}: ${err.message}`)
    }
  }

  // --- Phase B: Post activity feed entries for loan status transitions ---
  for (const loan of loans) {
    if (Date.now() - startTime > maxRuntimeMs) break
    if (result.activitiesPosted >= MAX_ACTIVITY_POSTS_PER_RUN) break

    const event = STATUS_EVENT_MAP[loan.status]
    if (!event) {
      // Rescinded or unknown status — skip
      continue
    }

    try {
      // Check dedup
      const dedupKey = loanStatusKey(loan.publicKey, loan.status)
      const alreadyProcessed = await redis.get(dedupKey)
      if (alreadyProcessed) {
        result.activitiesSkipped++
        continue
      }

      // Get wallets that should receive activity entries
      const relevantWallets = getRelevantWallets(loan, event)
      let posted = false

      for (const wallet of relevantWallets) {
        if (Date.now() - startTime > maxRuntimeMs) break

        try {
          // Resolve agent wallet → owner wallet
          const ownerWallet = await resolveToOwnerWallet(wallet)
          const profileId = await resolveWalletToProfileId(ownerWallet)
          if (!profileId) continue

          // For repaid loans, include interest in the amount
          let activityAmount = loan.debtAmountUi
          if (event === "repaid" && loan.start && loan.debtAmountUi > 0) {
            const elapsed = Math.min(loan.duration, Math.max(0, Math.floor(Date.now() / 1000) - loan.start))
            const interest = loan.debtAmountUi * loan.apy / 100 * elapsed / (365 * 86400)
            activityAmount = loan.debtAmountUi + interest
          }

          await postLoanActivity(profileId, event, {
            loanType: loan.offerType === "lend" ? "lend offer" : "borrow request",
            debtToken: loan.debtTokenSymbol,
            collateralToken: loan.collateralTokenSymbol,
            amount: activityAmount,
            apy: loan.apy,
            duration: loan.duration,
          })
          posted = true
        } catch (err: any) {
          result.errors.push(`activity:${loan.publicKey.slice(0, 8)}:${wallet.slice(0, 8)}: ${err.message}`)
        }
      }

      if (posted) {
        // Mark as processed only if at least one activity was posted
        await redis.set(dedupKey, "1")
        result.activitiesPosted++
      }
    } catch (err: any) {
      result.errors.push(`loan:${loan.publicKey.slice(0, 8)}: ${err.message}`)
    }
  }

  result.durationMs = Date.now() - startTime
  return result
}
