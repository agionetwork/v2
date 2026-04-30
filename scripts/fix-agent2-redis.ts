#!/usr/bin/env npx tsx
/**
 * BUG-016 FIX: Directly repair Agent2's missing Redis reverse key.
 *
 * The issue: agent:reverse:ANBHc8... key is missing, so resolveOwner
 * returns the agent wallet instead of the owner wallet FJGHg...
 *
 * This script:
 * 1. Diagnoses all agent Redis keys (forward + reverse)
 * 2. Writes the missing reverse key for Agent2
 * 3. Adds both owners to the agents:all persistent set
 * 4. Verifies the fix
 *
 * Usage: npx tsx scripts/fix-agent2-redis.ts
 */
import { readFileSync } from "fs"
import { Redis } from "@upstash/redis"

// Load .env.local manually (dotenv may not be installed)
const envContent = readFileSync(".env.local", "utf-8")
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/)
  if (match) process.env[match[1]] = match[2]
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
})

const AGENTS = [
  {
    label: "Agent1 (mr_agio_v2)",
    owner: "BYB6HLBur3gCZFGBm78RjGnFaMfdh7uyixB452HPuAac",
    agent: "2ZWbCwMRqrQhypDAwnVPg8XbjbfRqFjJMN2hshCZsPbS",
  },
  {
    label: "Agent2 (betatester_claude)",
    owner: "FJGHg1hycMgW3hiNPtp5mMMuXsrrpvnyTkUvxXfmY2QC",
    agent: "ANBHc8GbnSimjrjVaWQbFWXsyeebiFjM2dr6zUTg3Ggu",
  },
]

async function main() {
  console.log("=== BUG-016: Agent Redis Key Diagnostic & Repair ===\n")

  // Step 1: Diagnose current state
  console.log("--- Step 1: Current State ---")
  for (const a of AGENTS) {
    const forwardKey = `agent:${a.owner}:publicKey`
    const reverseKey = `agent:reverse:${a.agent}`

    const forwardVal = await redis.get<string>(forwardKey)
    const reverseVal = await redis.get<string>(reverseKey)

    console.log(`\n${a.label}:`)
    console.log(`  Forward: ${forwardKey}`)
    console.log(`    Value: ${forwardVal || "(MISSING)"}`)
    console.log(`    Expected: ${a.agent}`)
    console.log(`    Status: ${forwardVal === a.agent ? "✓ OK" : "✗ MISMATCH/MISSING"}`)

    console.log(`  Reverse: ${reverseKey}`)
    console.log(`    Value: ${reverseVal || "(MISSING)"}`)
    console.log(`    Expected: ${a.owner}`)
    console.log(`    Status: ${reverseVal === a.owner ? "✓ OK" : "✗ MISMATCH/MISSING"}`)
  }

  // Check sets
  const activeMembers = await redis.smembers("agents:active")
  const allMembers = await redis.smembers("agents:all")
  console.log(`\n  agents:active set: [${activeMembers.join(", ")}]`)
  console.log(`  agents:all set: [${allMembers.join(", ")}]`)

  // Step 2: Repair
  console.log("\n--- Step 2: Applying Repairs ---")
  let repaired = 0

  for (const a of AGENTS) {
    // Fix forward key if missing
    const forwardKey = `agent:${a.owner}:publicKey`
    const forwardVal = await redis.get<string>(forwardKey)
    if (forwardVal !== a.agent) {
      console.log(`  Writing forward key: ${forwardKey} = ${a.agent}`)
      await redis.set(forwardKey, a.agent)
      repaired++
    }

    // Fix reverse key if missing
    const reverseKey = `agent:reverse:${a.agent}`
    const reverseVal = await redis.get<string>(reverseKey)
    if (reverseVal !== a.owner) {
      console.log(`  Writing reverse key: ${reverseKey} = ${a.owner}`)
      await redis.set(reverseKey, a.owner)
      repaired++
    }

    // Ensure owner is in agents:all
    await redis.sadd("agents:all", a.owner)
  }

  if (repaired === 0) {
    console.log("  No repairs needed — all keys are correct.")
  } else {
    console.log(`  Repaired ${repaired} key(s).`)
  }

  // Step 3: Verify
  console.log("\n--- Step 3: Verification ---")
  for (const a of AGENTS) {
    const reverseVal = await redis.get<string>(`agent:reverse:${a.agent}`)
    const forwardVal = await redis.get<string>(`agent:${a.owner}:publicKey`)
    const ok = reverseVal === a.owner && forwardVal === a.agent
    console.log(`  ${a.label}: ${ok ? "✓ FIXED" : "✗ STILL BROKEN"}`)
    if (!ok) {
      console.log(`    forward=${forwardVal}, reverse=${reverseVal}`)
    }
  }

  // Verify sets
  const updatedAll = await redis.smembers("agents:all")
  console.log(`\n  agents:all set: [${updatedAll.join(", ")}]`)

  console.log("\nDone.")
}

main().catch(console.error)
