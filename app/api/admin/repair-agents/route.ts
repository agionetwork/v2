import { NextResponse } from "next/server"
import {
  getRedis,
  isRedisConfigured,
  getAgentPublicKey,
  getOwnerByAgentPublicKey,
  getActiveAgents,
} from "@/lib/agent/redis"
import { createConnection, createReadonlyProgram } from "@/lib/program"
import { parseLoanAccounts } from "@/lib/loan-utils"

/**
 * POST /api/admin/repair-agents
 *
 * Diagnoses and repairs missing `agent:reverse:` Redis keys by:
 * 1. Getting all unique wallets from on-chain loans
 * 2. For each, checking if it's an owner with an agent (forward key exists)
 * 3. Ensuring the reverse key exists; creating it if missing
 * 4. Also ensuring each owner is in the `agents:all` set
 *
 * This fixes the root cause of BUG-016: Agent2's reverse mapping was missing
 * because it may have been created before the reverse key was added, or
 * the key was lost, or the agent was never in `agents:active`.
 *
 * Protected: requires ADMIN_SECRET header.
 */
export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET
  const authHeader = request.headers.get("x-admin-secret")
  if (adminSecret && authHeader !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isRedisConfigured()) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 })
  }

  const redis = getRedis()
  const repairs: any[] = []
  const diagnostics: any[] = []

  // Collect ALL potential owner wallets from multiple sources
  const candidateOwners = new Set<string>()

  // Source 1: agents:active set
  const activeAgents = await getActiveAgents()
  for (const w of activeAgents) candidateOwners.add(w)

  // Source 2: agents:all set (if it exists)
  try {
    const allAgents = await redis.smembers("agents:all")
    for (const w of allAgents) candidateOwners.add(w)
  } catch { /* set may not exist yet */ }

  // Source 3: on-chain loan participants (lenders + borrowers)
  try {
    const connection = createConnection()
    const program = createReadonlyProgram(connection)
    const allAccounts = await (program.account as any).loan.all()
    const loans = parseLoanAccounts(allAccounts)
    for (const loan of loans) {
      if (loan.lender) candidateOwners.add(loan.lender)
      if (loan.borrower) candidateOwners.add(loan.borrower)
    }
  } catch (err: any) {
    diagnostics.push({ source: "on-chain", error: err.message })
  }

  // For each candidate, check if it's an owner wallet with an agent
  let repaired = 0
  let alreadyCorrect = 0
  let notAnOwner = 0

  for (const wallet of candidateOwners) {
    const agentPk = await getAgentPublicKey(wallet)
    if (!agentPk) {
      notAnOwner++
      continue
    }

    // This wallet IS an owner. Check if reverse key exists.
    const existingReverse = await getOwnerByAgentPublicKey(agentPk)

    if (existingReverse === wallet) {
      alreadyCorrect++
      continue
    }

    // Reverse key is missing or incorrect — repair it
    await redis.set(`agent:reverse:${agentPk}`, wallet)

    // Also ensure this owner is in the agents:all set
    await redis.sadd("agents:all", wallet)

    repairs.push({
      ownerWallet: wallet,
      agentPublicKey: agentPk,
      previousReverse: existingReverse || "(missing)",
      action: "repaired",
    })
    repaired++
  }

  // Also add all active agents to agents:all for future robustness
  if (activeAgents.length > 0) {
    for (const w of activeAgents) {
      await redis.sadd("agents:all", w)
    }
  }

  return NextResponse.json({
    success: true,
    candidatesChecked: candidateOwners.size,
    alreadyCorrect,
    repaired,
    notAnOwner,
    repairs,
    diagnostics,
    agentsActiveCount: activeAgents.length,
  })
}
