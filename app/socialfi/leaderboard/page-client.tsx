"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trophy, Award } from "lucide-react"
import Link from "next/link"
import { useLoans, type ParsedLoan } from "@/hooks/useLoans"
import { calculateAllPoints, formatPoints, type TokenPrices } from "@/lib/points"
import { useTokenPrices } from "@/hooks/useTokenPrices"
import { resolveWalletProfiles, getCustomProperty, type TapestryProfileResponse } from "@/lib/tapestry"

interface LeaderboardEntry {
  rank: number
  wallet: string
  points: number
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 4) + '...' + addr.slice(-4)
}

function getRankDisplay(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500 mx-auto" />
  if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400 mx-auto" />
  if (rank === 3) return <Trophy className="h-5 w-5 text-orange-500 mx-auto" />
  return <span className="text-muted-foreground font-medium">{rank}</span>
}

function buildLeaderboard(loans: ParsedLoan[], tokenPrices?: TokenPrices): LeaderboardEntry[] {
  const walletPointsMap = calculateAllPoints(loans, tokenPrices)

  const entries: LeaderboardEntry[] = []
  walletPointsMap.forEach((points, wallet) => {
    entries.push({ rank: 0, wallet, points })
  })

  return entries
}

async function mergeAgentPoints(
  entries: LeaderboardEntry[]
): Promise<LeaderboardEntry[]> {
  if (entries.length === 0) return entries

  try {
    const res = await fetch("/api/agent-owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallets: entries.map((e) => e.wallet) }),
    })
    const { mapping } = (await res.json()) as { mapping: Record<string, string | null> }

    // Merge agent points into owner entries
    const merged = new Map<string, number>()
    for (const entry of entries) {
      const owner = mapping[entry.wallet]
      const target = owner || entry.wallet
      merged.set(target, (merged.get(target) || 0) + entry.points)
    }

    return Array.from(merged.entries()).map(([wallet, points]) => ({
      rank: 0,
      wallet,
      points,
    }))
  } catch {
    return entries // fallback to unmerged
  }
}

export default function LeaderboardPageClient() {
  const { loans, loading } = useLoans()
  const { prices } = useTokenPrices()
  const [profileMap, setProfileMap] = useState<Map<string, TapestryProfileResponse>>(new Map())
  const [mergedLeaderboard, setMergedLeaderboard] = useState<LeaderboardEntry[]>([])

  // Extract simple { symbol: price } map for points calculation
  const tokenPrices = useMemo<TokenPrices>(() => {
    const result: TokenPrices = {}
    for (const [symbol, data] of Object.entries(prices)) {
      result[symbol] = data.price
    }
    return result
  }, [prices])

  const rawLeaderboard = useMemo(() => buildLeaderboard(loans, tokenPrices), [loans, tokenPrices])

  // Merge agent wallet points into owner entries
  useEffect(() => {
    mergeAgentPoints(rawLeaderboard).then(setMergedLeaderboard).catch(() => setMergedLeaderboard(rawLeaderboard))
  }, [rawLeaderboard])

  useEffect(() => {
    const wallets = mergedLeaderboard.map((e) => e.wallet)
    if (wallets.length === 0) return
    resolveWalletProfiles(wallets).then(setProfileMap).catch(() => {})
  }, [mergedLeaderboard])

  const sorted = useMemo(() =>
    [...mergedLeaderboard]
      .sort((a, b) => b.points - a.points)
      .map((entry, i) => ({ ...entry, rank: i + 1 })),
  [mergedLeaderboard])

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No activity yet</p>
              <p className="text-sm mt-1">The leaderboard will populate as users interact with the protocol</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] text-center">#</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((entry) => (
                  <TableRow key={entry.wallet}>
                    <TableCell className="text-center">
                      {getRankDisplay(entry.rank)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const tp = profileMap.get(entry.wallet)
                        const displayName = tp ? (getCustomProperty(tp.profile, "displayName") || tp.profile.username) : null
                        const pfp = tp ? getCustomProperty(tp.profile, "profileImage") : undefined
                        return (
                          <Link href={`/socialfi/profile/${entry.wallet}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <Avatar className="h-8 w-8">
                              {pfp ? <AvatarImage src={pfp} alt={displayName || entry.wallet} /> : null}
                              <AvatarFallback className="bg-blue-600 text-white text-xs">
                                {(displayName || entry.wallet).slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {displayName || shortenAddress(entry.wallet)}
                              </p>
                            </div>
                          </Link>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold">{formatPoints(entry.points)}</span>
                      <span className="text-yellow-500 text-xs font-bold ml-1">PTS</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
