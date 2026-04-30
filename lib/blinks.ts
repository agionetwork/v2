/**
 * Utilities for generating Solana Blinks (Action) URLs
 * for sharing loan offers on X/Twitter.
 */

function getAppUrl(): string {
  if (typeof window !== "undefined") return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL || "https://agio.network"
}

function getCluster(): string {
  return process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet"
}

/** Build a dial.to Blink URL for a loan's accept action */
export function getBlinkUrl(loanPublicKey: string): string {
  const actionUrl = `${getAppUrl()}/api/actions/accept/${loanPublicKey}`
  const cluster = getCluster()
  // dial.to uses /devnet path for devnet; mainnet uses root path
  const base = cluster === "mainnet-beta" || cluster === "mainnet"
    ? "https://dial.to"
    : `https://dial.to/${cluster}`
  return `${base}?action=solana-action:${encodeURIComponent(actionUrl)}`
}

/** Build a Twitter/X share intent URL */
export function getTwitterShareUrl(blinkUrl: string, text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(blinkUrl)}`
}
