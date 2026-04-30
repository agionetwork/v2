/**
 * Server-side Dialect notification sender.
 * Uses the Dialect REST API to send multi-channel notifications.
 * All functions are fire-and-forget safe — they catch errors silently.
 */

const DIALECT_API_URL = "https://alerts-api.dial.to"
const DIALECT_API_KEY = process.env.DIALECT_API_KEY || ""
const DIALECT_APP_ID = process.env.DIALECT_APP_ID || ""

type Channel = "EMAIL" | "IN_APP" | "TELEGRAM"

const DEFAULT_CHANNELS: Channel[] = ["EMAIL", "IN_APP", "TELEGRAM"]

interface SendParams {
  recipientWallet: string
  title: string
  body: string
  channels?: Channel[]
  actions?: { type: "link"; label: string; url: string }[]
}

export async function sendDialectNotification(params: SendParams): Promise<boolean> {
  if (!DIALECT_API_KEY || !DIALECT_APP_ID) return false

  try {
    const res = await fetch(`${DIALECT_API_URL}/v2/${DIALECT_APP_ID}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dialect-api-key": DIALECT_API_KEY,
      },
      body: JSON.stringify({
        recipient: {
          type: "subscriber",
          walletAddress: params.recipientWallet,
        },
        channels: params.channels || DEFAULT_CHANNELS,
        message: {
          title: params.title,
          body: params.body,
          ...(params.actions?.length ? { actions: params.actions } : {}),
        },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function broadcastDialectNotification(params: {
  title: string
  body: string
  channels?: Channel[]
}): Promise<boolean> {
  if (!DIALECT_API_KEY || !DIALECT_APP_ID) return false

  try {
    const res = await fetch(`${DIALECT_API_URL}/v2/${DIALECT_APP_ID}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dialect-api-key": DIALECT_API_KEY,
      },
      body: JSON.stringify({
        recipient: { type: "all-subscribers" },
        channels: params.channels || DEFAULT_CHANNELS,
        message: {
          title: params.title,
          body: params.body,
        },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// --- Event-specific helpers (fire-and-forget) ---

interface LoanDetails {
  debtToken?: string
  collateralToken?: string
  amount?: number
  apy?: number
  loanType?: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agio.network"

export async function notifyLoanCreated(recipientWallet: string, details: LoanDetails): Promise<void> {
  const label = details.loanType || "loan offer"
  const amount = details.amount ? `${details.amount} ${details.debtToken || ""}` : ""
  const apy = details.apy ? ` at ${details.apy}% APY` : ""
  sendDialectNotification({
    recipientWallet,
    title: "New Loan Offer",
    body: `You received a ${label}: ${amount}${apy}`.trim(),
    actions: [{ type: "link", label: "View Offers", url: `${APP_URL}/loan-offers` }],
  }).catch(() => {})
}

export async function notifyLoanAccepted(recipientWallet: string, details: LoanDetails): Promise<void> {
  const amount = details.amount ? `${details.amount} ${details.debtToken || ""}` : "your loan"
  sendDialectNotification({
    recipientWallet,
    title: "Loan Accepted",
    body: `Your loan offer of ${amount} was accepted.`.trim(),
    actions: [{ type: "link", label: "View Dashboard", url: `${APP_URL}/dashboard` }],
  }).catch(() => {})
}

export async function notifyLoanRepaid(recipientWallet: string, details: LoanDetails): Promise<void> {
  const amount = details.amount ? `${details.amount} ${details.debtToken || ""}` : "a loan"
  sendDialectNotification({
    recipientWallet,
    title: "Loan Repaid",
    body: `Loan of ${amount} has been repaid.`.trim(),
    actions: [{ type: "link", label: "View Dashboard", url: `${APP_URL}/dashboard` }],
  }).catch(() => {})
}

export async function notifyLoanForeclosed(recipientWallet: string, details: LoanDetails): Promise<void> {
  const amount = details.amount ? `${details.amount} ${details.debtToken || ""}` : "your loan"
  sendDialectNotification({
    recipientWallet,
    title: "Loan Foreclosed",
    body: `Your loan of ${amount} was foreclosed. Collateral has been claimed.`.trim(),
    actions: [{ type: "link", label: "View Dashboard", url: `${APP_URL}/dashboard` }],
  }).catch(() => {})
}

export async function notifyFriendRequest(recipientWallet: string, senderName: string): Promise<void> {
  sendDialectNotification({
    recipientWallet,
    title: "Friend Request",
    body: `${senderName} sent you a connection request.`,
    actions: [{ type: "link", label: "View Requests", url: `${APP_URL}/socialfi` }],
  }).catch(() => {})
}

export async function notifyFriendAccepted(recipientWallet: string, accepterName: string): Promise<void> {
  sendDialectNotification({
    recipientWallet,
    title: "Connection Accepted",
    body: `${accepterName} accepted your connection request.`,
    actions: [{ type: "link", label: "View Friends", url: `${APP_URL}/socialfi` }],
  }).catch(() => {})
}

export async function notifyCollateralAdded(
  recipientWallet: string,
  details: LoanDetails & { addedAmount?: number },
): Promise<void> {
  const amount = details.addedAmount ? `${details.addedAmount} ${details.collateralToken || ""}` : "collateral"
  sendDialectNotification({
    recipientWallet,
    title: "Collateral Added",
    body: `Borrower added ${amount} to your loan. Liquidation risk reduced.`.trim(),
    actions: [{ type: "link", label: "View Dashboard", url: `${APP_URL}/dashboard` }],
  }).catch(() => {})
}

export async function notifyNewFollower(recipientWallet: string, followerName: string): Promise<void> {
  sendDialectNotification({
    recipientWallet,
    title: "New Follower",
    body: `${followerName} started following you on Agio.`,
    actions: [{ type: "link", label: "View Profile", url: `${APP_URL}/socialfi` }],
  }).catch(() => {})
}

export async function notifyFriendRejected(recipientWallet: string, rejecterName: string): Promise<void> {
  sendDialectNotification({
    recipientWallet,
    title: "Connection Request Declined",
    body: `${rejecterName} declined your connection request.`,
    actions: [{ type: "link", label: "View Network", url: `${APP_URL}/socialfi` }],
  }).catch(() => {})
}

export async function notifyLoanExpiryWarning(
  recipientWallet: string,
  details: LoanDetails & { hoursRemaining?: number },
): Promise<void> {
  const amount = details.amount ? `${details.amount} ${details.debtToken || ""}` : "your loan"
  const timeLeft = details.hoursRemaining ? `in ~${details.hoursRemaining} hours` : "soon"
  sendDialectNotification({
    recipientWallet,
    title: "Loan Expiring Soon",
    body: `Your loan of ${amount} expires ${timeLeft}. Repay now to avoid liquidation.`.trim(),
    actions: [{ type: "link", label: "Repay Now", url: `${APP_URL}/dashboard` }],
  }).catch(() => {})
}

export async function notifyCollateralWarning(
  recipientWallet: string,
  details: LoanDetails & { currentRatio?: number; threshold?: number; role?: "borrower" | "lender" },
): Promise<void> {
  const amount = details.amount ? `${details.amount} ${details.debtToken || ""}` : "a loan"
  const ratio = details.currentRatio ? `${details.currentRatio.toFixed(0)}%` : "low"
  const isBorrower = details.role !== "lender"
  const action = isBorrower ? "Add collateral to avoid liquidation." : "Monitor this loan closely."
  const label = isBorrower ? "Add Collateral" : "View Dashboard"
  sendDialectNotification({
    recipientWallet,
    title: "Collateral At Risk",
    body: `Collateral ratio for ${amount} is ${ratio}. ${action}`.trim(),
    actions: [{ type: "link", label, url: `${APP_URL}/dashboard` }],
  }).catch(() => {})
}

// --- Network fan-out: notify followers of a loan creation ---

export async function notifyNetworkLoanCreated(
  creatorWallet: string,
  details: LoanDetails,
): Promise<void> {
  try {
    // Dynamic import to avoid circular deps (tapestry-server is heavy)
    const { searchProfiles, getFollowers } = await import("@/lib/tapestry-server")

    // Resolve creator wallet → profile ID
    const result = await searchProfiles(creatorWallet, 1, 0)
    const profileId = result.profiles[0]?.profile?.id
    if (!profileId) return

    // Get followers (up to 50)
    const { profiles: followers } = await getFollowers(profileId, 50, 1)
    if (!followers.length) return

    const label = details.loanType || "loan offer"
    const amount = details.amount ? `${details.amount} ${details.debtToken || ""}` : ""
    const apy = details.apy ? ` at ${details.apy}% APY` : ""
    const creatorShort = `${creatorWallet.slice(0, 4)}...${creatorWallet.slice(-4)}`

    // Send notification to each follower (fire-and-forget, parallel)
    await Promise.allSettled(
      followers
        .map((f) => f.profile?.walletAddress)
        .filter((w): w is string => !!w && w !== creatorWallet)
        .map((followerWallet) =>
          sendDialectNotification({
            recipientWallet: followerWallet,
            title: "New Offer in Your Network",
            body: `${creatorShort} created a ${label}: ${amount}${apy}`.trim(),
            actions: [{ type: "link", label: "View Offers", url: `${APP_URL}/loan-offers` }],
          }),
        ),
    )
  } catch {
    // Silently fail — notification fan-out should never block
  }
}
