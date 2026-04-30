#!/usr/bin/env npx tsx
/**
 * One-time script to update existing agent configs in Redis
 * with auto-create enabled and widened filters for devnet testing.
 */
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
})

const AGENT_WALLETS = [
  "C5RHKkqLcyFVGUydk5Vcqb5NsXr7JrU2nGySJmK1UhWj",
  "Dr2dFoyVxSJWq1PciW8oziXUDjz3FgdftUrCtL1WSUG2",
  "EYrcVyqCToRZ4mP6WXUpHnLRjnWRho3f5WhWKsoPy1GN",
]

async function main() {
  for (const w of AGENT_WALLETS) {
    const config = (await redis.get("agent:" + w + ":config")) as Record<string, unknown> | null
    if (!config) {
      console.log("No config for", w.slice(0, 8))
      continue
    }

    const updated = {
      ...config,
      lendAutoCreateOffers: true,
      borrowAutoCreateRequests: true,
      lendMinApy: 1,
      lendMinAmountUsd: 1,
      lendMaxAmountUsd: 5000,
      lendMaxDuration: 1,
      lendMinCollateralRatio: 100,
      lendMaxCollateralRatio: 500,
      borrowMinAmountUsd: 1,
      borrowMaxAmountUsd: 2000,
      borrowMaxApy: 50,
      borrowMaxDuration: 1,
      borrowMinCollateralRatio: 100,
      borrowMaxCollateralRatio: 500,
      borrowAutoRepay: true,
      socialAutoAcceptFriends: true,
    }

    await redis.set("agent:" + w + ":config", updated)
    console.log(
      `Updated ${w.slice(0, 8)}: autoCreate lend=${updated.lendAutoCreateOffers} borrow=${updated.borrowAutoCreateRequests} minApy=${updated.lendMinApy} lendMin=$${updated.lendMinAmountUsd} borrowMin=$${updated.borrowMinAmountUsd}`,
    )
  }

  // Nobility (human user) — keep auto-create disabled but widen acceptance filters
  const nobilityWallet = "DfmZoDmzmbG592hDH8zQtjXexpkUgcm6KzxoTWn1JrkF"
  const nConfig = (await redis.get("agent:" + nobilityWallet + ":config")) as Record<string, unknown> | null
  if (nConfig) {
    const updated = {
      ...nConfig,
      lendAutoCreateOffers: false,
      borrowAutoCreateRequests: false,
      lendMinApy: 1,
      lendMinAmountUsd: 1,
      borrowMinAmountUsd: 1,
      borrowMaxApy: 50,
      lendMinCollateralRatio: 100,
      lendMaxCollateralRatio: 500,
      borrowMinCollateralRatio: 100,
      borrowMaxCollateralRatio: 500,
      socialAutoAcceptFriends: true,
    }
    await redis.set("agent:" + nobilityWallet + ":config", updated)
    console.log("Updated Nobility (human) — auto-create disabled, widened filters")
  }

  console.log("\nDone!")
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
