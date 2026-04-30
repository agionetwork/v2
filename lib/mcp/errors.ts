/**
 * Centralized MCP error handling.
 * Transforms technical Solana/internal errors into user-friendly messages
 * with error codes and actionable suggestions.
 */

export interface McpError {
  code: string
  message: string
  suggestion?: string
  extra?: Record<string, any>
}

/**
 * Known error patterns mapped to user-friendly messages.
 * Order matters — first match wins.
 */
const ERROR_PATTERNS: {
  pattern: RegExp | string
  code: string
  message: string
  suggestion?: string
}[] = [
  // Balance / funding errors
  {
    pattern: /insufficient lamports/i,
    code: "INSUFFICIENT_SOL",
    message: "Insufficient SOL balance for transaction fees.",
    suggestion: "Your agent needs at least 0.01 SOL to cover rent and fees. Use devnet-airdrop to get SOL first.",
  },
  {
    pattern: /insufficient funds/i,
    code: "INSUFFICIENT_BALANCE",
    message: "Insufficient token balance for this operation.",
    suggestion: "Check your agent balance with get-agent-status and fund it if needed.",
  },
  {
    pattern: /Insufficient.*balance/i,
    code: "INSUFFICIENT_BALANCE",
    message: "Insufficient token balance for this operation.",
    suggestion: "Check your agent balance with get-agent-status and fund it if needed.",
  },
  // Account errors
  {
    pattern: /account not found/i,
    code: "ACCOUNT_NOT_FOUND",
    message: "Required token account does not exist.",
    suggestion: "Ensure the wallet has an active token account for this token. The account is created automatically on first transfer.",
  },
  {
    pattern: /AccountNotFound/i,
    code: "ACCOUNT_NOT_FOUND",
    message: "Required account does not exist on-chain.",
    suggestion: "The token account may not have been initialized. Try funding the agent wallet first.",
  },
  // Profile errors
  {
    pattern: /Target profile not found/i,
    code: "TARGET_PROFILE_NOT_FOUND",
    message: "No profile found for the target wallet.",
    suggestion: "The target user must create a profile first using the create-profile tool.",
  },
  {
    pattern: /Profile not found/i,
    code: "PROFILE_NOT_FOUND",
    message: "No profile found for this wallet.",
    suggestion: "Create a profile first using the create-profile tool.",
  },
  // Agent errors
  {
    pattern: /Agent not found/i,
    code: "AGENT_NOT_FOUND",
    message: "No agent found for this wallet.",
    suggestion: "Create an agent first using the create-agent tool.",
  },
  {
    pattern: /Agent already exists/i,
    code: "AGENT_EXISTS",
    message: "An agent already exists for this wallet.",
    suggestion: "Use get-agent-status to check your existing agent.",
  },
  // Self-lending
  {
    pattern: /Cannot accept your own/i,
    code: "SELF_LENDING_BLOCKED",
    message: "Cannot accept your own offer. Lender and borrower must be different wallets.",
  },
  // Loan errors
  {
    pattern: /Loan not found/i,
    code: "LOAN_NOT_FOUND",
    message: "Loan not found.",
    suggestion: "Verify the loanPublicKey is correct using list-loans.",
  },
  {
    pattern: /Loan is not pending/i,
    code: "LOAN_NOT_PENDING",
    message: "This loan is not in pending status and cannot be acted upon.",
  },
  {
    pattern: /Loan is not active/i,
    code: "LOAN_NOT_ACTIVE",
    message: "This loan is not active.",
  },
  {
    pattern: /not expired/i,
    code: "LOAN_NOT_EXPIRED",
    message: "This loan has not expired yet and cannot be foreclosed.",
  },
  // Self-action errors
  {
    pattern: /Cannot send a friend request to yourself/i,
    code: "SELF_FRIEND_REQUEST",
    message: "Cannot send a friend request to yourself.",
  },
  {
    pattern: /Cannot follow yourself/i,
    code: "SELF_ACTION",
    message: "Cannot follow yourself.",
  },
  {
    pattern: /Already following/i,
    code: "ALREADY_FOLLOWING",
    message: "You are already following this user.",
  },
  // Devnet feature restrictions
  {
    pattern: /not available on.*devnet/i,
    code: "DEVNET_NOT_SUPPORTED",
    message: "This feature is not available on Solana devnet.",
    suggestion: "This operation is only supported on mainnet.",
  },
  // Rate limits
  {
    pattern: /Rate limit exceeded/i,
    code: "RATE_LIMITED",
    message: "Rate limit exceeded.",
    suggestion: "Wait 60 seconds and try again.",
  },
  // Payment errors
  {
    pattern: /replay attack/i,
    code: "PAYMENT_REPLAY",
    message: "This payment proof has already been used.",
    suggestion: "Create a new payment transaction and try again.",
  },
  // Transaction simulation failures
  {
    pattern: /Transaction simulation failed/i,
    code: "SIMULATION_FAILED",
    message: "Transaction simulation failed on the Solana network.",
    suggestion: "This usually means insufficient balance or an expired blockhash. Try again.",
  },
  {
    pattern: /blockhash not found/i,
    code: "BLOCKHASH_EXPIRED",
    message: "Transaction blockhash has expired.",
    suggestion: "Try the operation again — a fresh blockhash will be used.",
  },
]

/**
 * Sanitize a raw error into a user-friendly MCP error.
 * Strips internal program names, compute units, and simulation logs.
 */
export function sanitizeError(err: unknown): McpError {
  const rawMessage = err instanceof Error ? err.message : String(err)

  // Structured balance error extraction (token, available, required)
  const balanceMatch = rawMessage.match(
    /Insufficient\s+(\w+)\s+(?:balance|collateral):\s+(?:have\s+)?([0-9.]+)\.?\s+Need\s+([0-9.]+)/i,
  )
  if (balanceMatch) {
    return {
      code: "INSUFFICIENT_BALANCE",
      message: rawMessage,
      suggestion: "Check your agent balance with get-agent-status and fund it if needed.",
      extra: {
        token: balanceMatch[1],
        available: parseFloat(balanceMatch[2]),
        required: parseFloat(balanceMatch[3]),
      },
    }
  }

  // Check known patterns
  for (const { pattern, code, message, suggestion } of ERROR_PATTERNS) {
    const matches =
      typeof pattern === "string"
        ? rawMessage.includes(pattern)
        : pattern.test(rawMessage)
    if (matches) {
      return { code, message, suggestion }
    }
  }

  // Strip Solana simulation logs (Program log, compute units, etc.)
  const sanitized = rawMessage
    .replace(/Program log:.*$/gm, "")
    .replace(/Program \w+ consumed \d+ of \d+ compute units/g, "")
    .replace(/Program \w+ invoke.*$/gm, "")
    .replace(/Program \w+ success$/gm, "")
    .replace(/Transaction simulation failed:.*Logs:\s*/i, "Transaction failed. ")
    .replace(/\n\s*\n/g, "\n")
    .trim()

  // If the sanitized message is still too long or contains internal details, truncate
  const maxLen = 200
  const finalMessage =
    sanitized.length > maxLen
      ? sanitized.slice(0, maxLen) + "..."
      : sanitized || "An unexpected error occurred"

  return {
    code: "UNKNOWN_ERROR",
    message: finalMessage,
  }
}

/**
 * Format a sanitized error for MCP JSON response.
 */
export function formatMcpError(err: unknown): {
  error: string
  errorCode: string
  suggestion?: string
} {
  const { code, message, suggestion } = sanitizeError(err)
  return {
    error: message,
    errorCode: code,
    ...(suggestion ? { suggestion } : {}),
  }
}
