"use client"

import Link from "next/link"
import { TableCell } from "@/components/ui/table"
import { useWalletProfile } from "@/hooks/useWalletProfile"

/**
 * Renders a table cell with a resolved wallet profile name (linked to the profile page).
 * Handles agent wallets transparently via reverse lookup → owner Tapestry profile.
 */
export function WalletNameCell({
  address,
  fallback = "Open",
}: {
  address: string | null
  fallback?: string
}) {
  const { displayName, profileWallet } = useWalletProfile(address)

  if (!address) {
    return (
      <TableCell className="text-center text-sm text-muted-foreground">
        {fallback}
      </TableCell>
    )
  }

  return (
    <TableCell className="text-center text-sm">
      <Link
        href={`/socialfi/profile/${profileWallet || address}`}
        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
      >
        {displayName || fallback}
      </Link>
    </TableCell>
  )
}
