"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, UserPlus, Users, Clock, Check } from "lucide-react"
import Link from "next/link"
import { useFriends } from "@/components/friends-provider"
import { getCustomProperty } from "@/lib/tapestry"
import { toast } from "sonner"
import { useSolDomain } from "@/hooks/useSNS"
import type { FriendSuggestion } from "@/hooks/useFriends"

function SuggestionCard({ suggestion }: { suggestion: FriendSuggestion }) {
  const { sendRequest, acceptRequest, getFriendshipStatus, receivedRequests } = useFriends()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const p = suggestion.profile.profile
  const displayName = getCustomProperty(p, "displayName") || p.username
  const pfp = getCustomProperty(p, "profileImage") || p.image
  const solDomain = useSolDomain(p.walletAddress)
  const status = getFriendshipStatus(p.id)

  const handleAdd = async () => {
    setSending(true)
    // If they already sent us a request, auto-accept instead of creating a new one
    if (status === "pending_received") {
      const request = receivedRequests.find((r) => r.senderProfileId === p.id)
      if (request) {
        const success = await acceptRequest(request.contentId, request.pairContentId, p.id)
        if (success) {
          toast.success(`Connected with ${displayName}`)
          setAccepted(true)
        } else {
          toast.error("Failed to connect")
        }
        setSending(false)
        return
      }
    }
    const success = await sendRequest(p.id, p.walletAddress)
    if (success) {
      toast.success(`Friend request sent to ${displayName}`)
      setSent(true)
    } else {
      toast.error("Failed to send request")
    }
    setSending(false)
  }

  return (
    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-200/10 hover:shadow-lg transition-all duration-200">
      <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
        <Link href={`/socialfi/profile/${p.walletAddress}`}>
          <Avatar className="h-16 w-16 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all">
            {pfp ? <AvatarImage src={pfp} alt={displayName} /> : null}
            <AvatarFallback className="bg-blue-600 text-white text-lg">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="space-y-1">
          <Link href={`/socialfi/profile/${p.walletAddress}`} className="hover:text-blue-600 transition-colors">
            <p className="font-semibold text-sm truncate max-w-[160px]">{solDomain || displayName}</p>
          </Link>
        </div>

        <Badge variant="secondary" className="text-xs">
          <Users className="h-3 w-3 mr-1" />
          {suggestion.mutualCount} mutual
        </Badge>

        {accepted ? (
          <Badge variant="secondary" className="w-full justify-center py-2 px-5 text-xs">
            <Check className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        ) : sent ? (
          <Badge variant="secondary" className="w-full justify-center py-2 px-5 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        ) : (
          <Button
            size="sm"
            className="w-full bg-[#1358EC] hover:bg-blue-700 text-white"
            onClick={handleAdd}
            disabled={sending}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function FriendSuggestions({ showEmpty = false, searchQuery = "" }: { showEmpty?: boolean; searchQuery?: string }) {
  const { suggestions, loadingSuggestions } = useFriends()

  let filtered = suggestions.filter((s) => s.profile.profile.username !== "testuser")

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter((s) => {
      const p = s.profile.profile
      const name = (getCustomProperty(p, "displayName") || p.username || "").toLowerCase()
      const wallet = (p.walletAddress || "").toLowerCase()
      return name.includes(q) || wallet.includes(q)
    })
  }

  if (loadingSuggestions) {
    if (!showEmpty) return null
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (filtered.length === 0) {
    if (!showEmpty) return null
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">{searchQuery ? "No suggestions found" : "No suggestions yet"}</p>
          <p className="text-sm">{searchQuery ? "Try a different search." : "Add more connections to see suggestions."}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {filtered.map((s) => (
        <SuggestionCard key={s.profile.profile.id} suggestion={s} />
      ))}
    </div>
  )
}
