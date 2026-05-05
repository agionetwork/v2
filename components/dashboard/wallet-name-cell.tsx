"use client"

import Link from "next/link"
import { TableCell } from "@/components/ui/table"
import { useWalletProfile } from "@/hooks/useWalletProfile"

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

/**
 * Renders a table cell with a resolved wallet profile name (linked to the profile page).
 * Handles agent wallets transparently via reverse lookup → owner Tapestry profile.
 */
export function WalletNameCell({
  address,
  fallback = "Open",
  forceMask = false,
}: {
  address: string | null
  /** Text rendered when `address` is null (no counterparty yet). */
  fallback?: string
  /**
   * Mask the address as "Anonymous (private)" even when the address itself is
   * NOT a stealth. Use this on dashboards when the *current user* opted into
   * privacy on their side of the loan — UX-wise the user expects a fully
   * private view (the on-chain data is still public, but their dashboard
   * shouldn't surface counterparty identities back at them).
   */
  forceMask?: boolean
}) {
  const { displayName, profileWallet, isStealth } = useWalletProfile(address)

  if (!address) {
    return (
      <TableCell className="text-center text-sm text-muted-foreground">
        {fallback}
      </TableCell>
    )
  }

  // Stealth wallets render as a non-clickable masked label so the cell can't
  // de-anonymize the on-chain participant via a profile link or a name lookup.
  if (isStealth || forceMask) {
    return (
      <TableCell className="text-center text-sm text-muted-foreground italic">
        Anonymous
      </TableCell>
    )
  }

  return (
    <TableCell className="text-center text-sm">
      <Link
        href={`/socialfi/profile/${profileWallet || address}`}
        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
      >
        {displayName || shortenAddress(address)}
      </Link>
    </TableCell>
  )
}
