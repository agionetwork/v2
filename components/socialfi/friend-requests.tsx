"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, X, Clock, UserPlus } from "lucide-react"
import Link from "next/link"
import { useFriends } from "@/components/friends-provider"
import { toast } from "sonner"
import {
  type FriendRequest,
  type TapestryProfileResponse,
  getProfile,
  getCustomProperty,
} from "@/lib/tapestry"

function useRequestProfiles(requests: FriendRequest[], field: "sender" | "target") {
  const [profiles, setProfiles] = useState<Map<string, TapestryProfileResponse>>(new Map())

  const profileIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of requests) {
      ids.add(field === "sender" ? r.senderProfileId : r.targetProfileId)
    }
    return [...ids]
  }, [requests, field])

  useEffect(() => {
    if (profileIds.length === 0) return
    let cancelled = false

    async function fetchAll() {
      const results = await Promise.allSettled(
        profileIds.map((id) => getProfile(id))
      )
      if (cancelled) return
      const map = new Map<string, TapestryProfileResponse>()
      for (let i = 0; i < profileIds.length; i++) {
        const r = results[i]
        if (r.status === "fulfilled") {
          map.set(profileIds[i], r.value)
        }
      }
      setProfiles(map)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [profileIds])

  return profiles
}

function getProfileDisplay(profileId: string, profiles: Map<string, TapestryProfileResponse>) {
  const p = profiles.get(profileId)
  if (!p) return { displayName: profileId.slice(0, 8), pfp: undefined }
  const displayName = getCustomProperty(p.profile, "displayName") || p.profile.username || profileId.slice(0, 8)
  const pfp = getCustomProperty(p.profile, "profileImage") || p.profile.image
  return { displayName, pfp }
}

function ReceivedRequestCard({
  request,
  profiles,
}: {
  request: FriendRequest
  profiles: Map<string, TapestryProfileResponse>
}) {
  const { acceptRequest, rejectRequest } = useFriends()
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null)

  const handleAccept = async () => {
    setLoading("accept")
    const success = await acceptRequest(request.contentId, request.pairContentId, request.senderProfileId)
    if (success) {
      toast.success("Friend request accepted!")
    } else {
      toast.error("Failed to accept request")
    }
    setLoading(null)
  }

  const handleReject = async () => {
    setLoading("reject")
    const success = await rejectRequest(request.contentId, request.pairContentId)
    if (success) {
      toast.success("Request declined")
    } else {
      toast.error("Failed to decline request")
    }
    setLoading(null)
  }

  const { displayName, pfp } = getProfileDisplay(request.senderProfileId, profiles)

  return (
    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-200/10">
      <CardContent className="p-4 flex items-center gap-4">
        <Link href={`/socialfi/profile/${request.senderWallet}`}>
          <Avatar className="h-12 w-12 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all">
            {pfp ? <AvatarImage src={pfp} alt={displayName} /> : null}
            <AvatarFallback className="bg-blue-600 text-white">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/socialfi/profile/${request.senderWallet}`} className="hover:text-blue-600 transition-colors">
            <p className="font-semibold text-sm truncate">{displayName}</p>
          </Link>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-[#1358EC] hover:bg-blue-700 text-white"
            onClick={handleAccept}
            disabled={loading !== null}
          >
            {loading === "accept" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={loading !== null}
          >
            {loading === "reject" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SentRequestCard({
  request,
  profiles,
}: {
  request: FriendRequest
  profiles: Map<string, TapestryProfileResponse>
}) {
  const { displayName, pfp } = getProfileDisplay(request.targetProfileId, profiles)

  return (
    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-200/10">
      <CardContent className="p-4 flex items-center gap-4">
        <Link href={`/socialfi/profile/${request.targetWallet}`}>
          <Avatar className="h-12 w-12 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all">
            {pfp ? <AvatarImage src={pfp} alt={displayName} /> : null}
            <AvatarFallback className="bg-gray-400 text-white">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/socialfi/profile/${request.targetWallet}`} className="hover:text-blue-600 transition-colors">
            <p className="font-semibold text-sm truncate">{displayName}</p>
          </Link>
        </div>
        <Badge variant="secondary" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      </CardContent>
    </Card>
  )
}

export function FriendRequests() {
  const { receivedRequests, sentRequests, loadingRequests } = useFriends()
  const senderProfiles = useRequestProfiles(receivedRequests, "sender")
  const targetProfiles = useRequestProfiles(sentRequests, "target")

  if (loadingRequests) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (receivedRequests.length === 0 && sentRequests.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <UserPlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">No pending requests</p>
          <p className="text-sm">When you send or receive connection requests, they'll appear here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="border border-gray-200 dark:border-gray-200/10 rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-2 border-b border-gray-200 dark:border-gray-200/10 bg-muted/50">
        <div className="px-4 py-3 text-center text-sm font-semibold border-r border-gray-200 dark:border-gray-200/10">
          Received ({receivedRequests.length})
        </div>
        <div className="px-4 py-3 text-center text-sm font-semibold">
          Sent ({sentRequests.length})
        </div>
      </div>

      {/* Table Body */}
      <div className="grid grid-cols-2">
        {/* Received Column */}
        <div className="border-r border-gray-200 dark:border-gray-200/10 p-3 space-y-2 min-h-[120px]">
          {receivedRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No received requests.</p>
          ) : (
            receivedRequests.map((r) => (
              <ReceivedRequestCard key={r.contentId} request={r} profiles={senderProfiles} />
            ))
          )}
        </div>

        {/* Sent Column */}
        <div className="p-3 space-y-2 min-h-[120px]">
          {sentRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No sent requests.</p>
          ) : (
            sentRequests.map((r) => (
              <SentRequestCard key={r.contentId} request={r} profiles={targetProfiles} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
