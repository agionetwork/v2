import { NextRequest, NextResponse } from "next/server"
import { verifyWalletSignature, isValidSolanaAddress } from "@/lib/agent/auth"
import { getAgentConfig, setAgentConfig, hasAgent } from "@/lib/agent/redis"
import { type AgentConfig, VALID_TOKENS } from "@/lib/agent/types"

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet param" }, { status: 400 })
  }
  if (!isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 })
  }

  const signature = req.nextUrl.searchParams.get("signature")
  const message = req.nextUrl.searchParams.get("message")
  if (!signature || !message) {
    return NextResponse.json({ error: "Missing auth params" }, { status: 400 })
  }
  if (message !== `agio-auth:${wallet}`) {
    return NextResponse.json({ error: "Invalid auth message" }, { status: 400 })
  }
  if (!verifyWalletSignature(wallet, signature, message)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const config = await getAgentConfig(wallet)
  if (!config) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  return NextResponse.json({ config })
}

function validateConfig(config: Partial<AgentConfig>): string | null {
  // APY
  if (config.lendMinApy !== undefined && (config.lendMinApy < 0 || config.lendMinApy > 100)) {
    return "lendMinApy must be 0-100"
  }
  if (config.borrowMaxApy !== undefined && (config.borrowMaxApy < 0 || config.borrowMaxApy > 100)) {
    return "borrowMaxApy must be 0-100"
  }

  // USD amount ranges
  if (config.lendMinAmountUsd !== undefined && config.lendMinAmountUsd < 0) {
    return "lendMinAmountUsd must be >= 0"
  }
  if (config.lendMaxAmountUsd !== undefined && config.lendMaxAmountUsd <= 0) {
    return "lendMaxAmountUsd must be > 0"
  }
  if (config.lendMinAmountUsd !== undefined && config.lendMaxAmountUsd !== undefined
      && config.lendMinAmountUsd > config.lendMaxAmountUsd) {
    return "lendMinAmountUsd must be <= lendMaxAmountUsd"
  }
  if (config.borrowMinAmountUsd !== undefined && config.borrowMinAmountUsd < 0) {
    return "borrowMinAmountUsd must be >= 0"
  }
  if (config.borrowMaxAmountUsd !== undefined && config.borrowMaxAmountUsd <= 0) {
    return "borrowMaxAmountUsd must be > 0"
  }
  if (config.borrowMinAmountUsd !== undefined && config.borrowMaxAmountUsd !== undefined
      && config.borrowMinAmountUsd > config.borrowMaxAmountUsd) {
    return "borrowMinAmountUsd must be <= borrowMaxAmountUsd"
  }

  // Collateral ratio ranges (protocol minimum is the 125% creation threshold)
  if (config.lendMinCollateralRatio !== undefined && config.lendMinCollateralRatio < 125) {
    return "lendMinCollateralRatio must be >= 125 (protocol creation minimum)"
  }
  if (config.lendMaxCollateralRatio !== undefined && config.lendMaxCollateralRatio > 500) {
    return "lendMaxCollateralRatio must be <= 500"
  }
  if (config.lendMinCollateralRatio !== undefined && config.lendMaxCollateralRatio !== undefined
      && config.lendMinCollateralRatio > config.lendMaxCollateralRatio) {
    return "lendMinCollateralRatio must be <= lendMaxCollateralRatio"
  }
  if (config.borrowMinCollateralRatio !== undefined && config.borrowMinCollateralRatio < 125) {
    return "borrowMinCollateralRatio must be >= 125 (protocol creation minimum)"
  }
  if (config.borrowMaxCollateralRatio !== undefined && config.borrowMaxCollateralRatio > 500) {
    return "borrowMaxCollateralRatio must be <= 500"
  }
  if (config.borrowMinCollateralRatio !== undefined && config.borrowMaxCollateralRatio !== undefined
      && config.borrowMinCollateralRatio > config.borrowMaxCollateralRatio) {
    return "borrowMinCollateralRatio must be <= borrowMaxCollateralRatio"
  }

  // Health-factor settings (safety redesign)
  if (config.lendMinHealthFactor !== undefined && config.lendMinHealthFactor < 1.1) {
    return "lendMinHealthFactor must be >= 1.10 (foreclosure threshold)"
  }
  if (config.borrowAddCollateralThreshold !== undefined && config.borrowAddCollateralThreshold <= 1.15) {
    return "borrowAddCollateralThreshold must be > 1.15 (above the warning zone)"
  }

  // Duration
  if (config.lendMaxDuration !== undefined && (config.lendMaxDuration < 1 || config.lendMaxDuration > 365)) {
    return "lendMaxDuration must be 1-365 days"
  }
  if (config.borrowMaxDuration !== undefined && (config.borrowMaxDuration < 1 || config.borrowMaxDuration > 365)) {
    return "borrowMaxDuration must be 1-365 days"
  }

  // Token validation
  const validTokenSet = new Set<string>(VALID_TOKENS)
  for (const arr of [config.lendTokens, config.lendAcceptedCollateral, config.borrowTokens, config.borrowCollateralTokens]) {
    if (arr) {
      for (const t of arr) {
        if (!validTokenSet.has(t)) return `Invalid token: ${t}`
      }
    }
  }
  return null
}

export async function PUT(req: NextRequest) {
  try {
    const { wallet, signature, message, config: newConfig } = await req.json()

    if (!wallet || !signature || !message || !newConfig) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!verifyWalletSignature(wallet, signature, message)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    if (!(await hasAgent(wallet))) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    const validationError = validateConfig(newConfig)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const existing = await getAgentConfig(wallet)
    if (!existing) {
      return NextResponse.json({ error: "Agent config not found" }, { status: 404 })
    }

    // Merge new config with existing, preserving createdAt and enabled
    const merged: AgentConfig = {
      ...existing,
      ...newConfig,
      createdAt: existing.createdAt,
      enabled: existing.enabled,
    }

    await setAgentConfig(wallet, merged)
    return NextResponse.json({ success: true, config: merged })
  } catch (err: any) {
    console.error("Agent config update error:", err)
    const safeError =
      process.env.NODE_ENV === "production" ? "Internal error" : err.message || "Internal error"
    return NextResponse.json({ error: safeError }, { status: 500 })
  }
}
