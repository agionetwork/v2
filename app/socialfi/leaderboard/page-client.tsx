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
import { resolveWalletProfiles, getCustomProperty, type TapestryProfileResponse } from "@/lib/tapestry"
import { FairScoreBadge } from "@/components/fairscore-badge"
import type { FairScore } from "@/lib/fairscale"

interface LeaderboardEntry extends FairScore {
  rank: number
}

const EXCLUDED_DISPLAY_NAMES = new Set([
  "Agio Test Agent",
  "Lucas Ferreira",
  "Marina Costa",
])

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 4) + "..." + addr.slice(-4)
}

function getRankDisplay(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500 mx-auto" />
  if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400 mx-auto" />
  if (rank === 3) return <Trophy className="h-5 w-5 text-orange-500 mx-auto" />
  return <span className="text-muted-foreground font-medium">{rank}</span>
}

/** Walk loans and pull every distinct lender + borrower pubkey. */
function collectLoanParties(loans: ParsedLoan[]): Set<string> {
  const out = new Set<string>()
  for (const loan of loans) {
    if (loan.lender) out.add(loan.lender)
    if (loan.borrower) out.add(loan.borrower)
  }
  return out
}

async function resolveAgentOwners(wallets: string[]): Promise<string[]> {
  if (wallets.length === 0) return []
  try {
    const res = await fetch("/api/agent-owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallets }),
    })
    const { mapping } = (await res.json()) as { mapping: Record<string, string | null> }
    return wallets.map((w) => mapping[w] || w)
  } catch {
    return wallets
  }
}

async function fetchHolders(): Promise<string[]> {
  // /api/social-points/all still returns the canonical holder set for the
  // platform: connect-only users that never transacted on chain. We use it
  // strictly as a "who shows up on the leaderboard" universe; the actual
  // ranking is FairScale.
  try {
    const res = await fetch("/api/social-points/all?wallets=")
    const body = (await res.json()) as { holders?: string[] }
    return body.holders ?? []
  } catch {
    return []
  }
}

async function fetchScores(wallets: string[]): Promise<FairScore[]> {
  if (wallets.length === 0) return []
  try {
    const res = await fetch("/api/fairscale/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallets }),
    })
    const body = (await res.json()) as { scores: FairScore[] }
    return body.scores ?? []
  } catch {
    return []
  }
}

async function resolveAndFilter(
  scores: FairScore[],
): Promise<{ scores: FairScore[]; profileMap: Map<string, TapestryProfileResponse> }> {
  if (scores.length === 0) return { scores, profileMap: new Map() }
  let profileMap: Map<string, TapestryProfileResponse>
  try {
    profileMap = await resolveWalletProfiles(scores.map((s) => s.wallet))
  } catch {
    profileMap = new Map()
  }
  const kept = scores.filter((s) => {
    const tp = profileMap.get(s.wallet)
    if (!tp) return true
    const name = getCustomProperty(tp.profile, "displayName") || tp.profile.username
    return !name || !EXCLUDED_DISPLAY_NAMES.has(name)
  })
  return { scores: kept, profileMap }
}

export default function LeaderboardPageClient() {
  const { loans, loading } = useLoans()
  const [profileMap, setProfileMap] = useState<Map<string, TapestryProfileResponse>>(new Map())
  const [scores, setScores] = useState<FairScore[]>([])
  const [loadingScores, setLoadingScores] = useState(false)

  const onChainWallets = useMemo(() => collectLoanParties(loans), [loans])

  useEffect(() => {
    let cancelled = false
    setLoadingScores(true)
    ;(async () => {
      // Universe of leaderboard candidates: distinct loan parties + holders
      // tracked in the social-points registry (connect-only users count too).
      const onChain = Array.from(onChainWallets)
      const owners = await resolveAgentOwners(onChain)
      const holders = await fetchHolders()
      const universe = Array.from(new Set([...owners, ...holders]))
      if (cancelled) return

      const fetched = await fetchScores(universe)
      if (cancelled) return

      const { scores: filtered, profileMap: pm } = await resolveAndFilter(fetched)
      if (cancelled) return

      setScores(filtered)
      setProfileMap(pm)
      setLoadingScores(false)
    })().catch(() => {
      if (!cancelled) setLoadingScores(false)
    })
    return () => { cancelled = true }
  }, [onChainWallets])

  const sorted: LeaderboardEntry[] = useMemo(
    () =>
      [...scores]
        .sort((a, b) => b.score - a.score)
        .map((entry, i) => ({ ...entry, rank: i + 1 })),
    [scores],
  )

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Leaderboard
            <span className="text-xs font-normal text-muted-foreground ml-2">powered by Fairscale</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || loadingScores ? (
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
                  <TableHead className="text-right">FairScore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((entry) => {
                  const tp = profileMap.get(entry.wallet)
                  const displayName = tp ? (getCustomProperty(tp.profile, "displayName") || tp.profile.username) : null
                  const pfp = tp ? getCustomProperty(tp.profile, "profileImage") : undefined
                  return (
                    <TableRow key={entry.wallet}>
                      <TableCell className="text-center">{getRankDisplay(entry.rank)}</TableCell>
                      <TableCell>
                        <Link
                          href={`/socialfi/profile/${entry.wallet}`}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
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
                      </TableCell>
                      <TableCell className="text-right">
                        <FairScoreBadge
                          score={entry.score}
                          tier={entry.tier}
                          subOnchain={entry.subOnchain}
                          subSocial={entry.subSocial}
                          subBehavioral={entry.subBehavioral}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
