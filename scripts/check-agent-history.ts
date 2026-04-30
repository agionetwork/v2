#!/usr/bin/env npx tsx
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
})

const wallets = [
  "C5RHKkqLcyFVGUydk5Vcqb5NsXr7JrU2nGySJmK1UhWj",
  "Dr2dFoyVxSJWq1PciW8oziXUDjz3FgdftUrCtL1WSUG2",
  "EYrcVyqCToRZ4mP6WXUpHnLRjnWRho3f5WhWKsoPy1GN",
]

async function main() {
  for (const w of wallets) {
    const history = (await redis.get<any[]>("agent:" + w + ":history")) || []
    const nonScan = history.filter((a: any) => a.type !== "scan")
    console.log(`\n=== ${w.slice(0, 8)} (${nonScan.length} actions, ${history.length} total) ===`)
    for (const a of nonScan.slice(0, 20)) {
      console.log(`  [${a.type}] ${a.status} | ${a.details?.slice(0, 150)}`)
      if (a.txHash) console.log(`    tx: ${a.txHash}`)
    }
  }
}

main().catch(console.error)
