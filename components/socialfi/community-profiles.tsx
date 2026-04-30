"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, Clock, Users, Star } from "lucide-react"
import Link from "next/link"
import { useFriends } from "@/components/friends-provider"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import {
  searchProfiles,
  getCustomProperty,
  isTapestryConfigured,
  type TapestryProfileResponse,
} from "@/lib/tapestry"
import { useFavorites } from "@/hooks/useFavorites"
import { toast } from "sonner"
import { useSolDomain } from "@/hooks/useSNS"

export function ProfileCard({
  profile,
  myProfileId,
}: {
  profile: TapestryProfileResponse
  myProfileId: string | null
}) {
  const { getFriendshipStatus, sendRequest, acceptRequest, receivedRequests } = useFriends()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [loading, setLoading] = useState(false)

  const p = profile.profile
  const isMe = myProfileId === p.id
  const customName = getCustomProperty(p, "displayName")
  const displayName = customName || p.username
  const pfp = getCustomProperty(p, "profileImage") || p.image
  const solDomain = useSolDomain(p.walletAddress)
  const status = myProfileId ? getFriendshipStatus(p.id) : "none"
  const favorited = isFavorite(p.id)

  const handleAdd = async () => {
    setLoading(true)
    const success = await sendRequest(p.id, p.walletAddress)
    if (success) {
      toast.success(`Friend request sent to ${displayName}`)
    } else {
      toast.error("Failed to send request")
    }
    setLoading(false)
  }

  const handleAccept = async () => {
    const request = receivedRequests.find((r) => r.senderProfileId === p.id)
    if (!request) return
    setLoading(true)
    const success = await acceptRequest(request.contentId, request.pairContentId, p.id)
    if (success) {
      toast.success(`You are now friends with ${displayName}`)
    } else {
      toast.error("Failed to accept request")
    }
    setLoading(false)
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const nowFavorited = await toggleFavorite(p.id)
    if (nowFavorited) {
      toast.success(`Added ${displayName} to favourites`)
    } else {
      toast.success(`Removed ${displayName} from favourites`)
    }
  }

  const renderAction = () => {
    if (isMe || !myProfileId) return null

    switch (status) {
      case "friend":
        return (
          <Badge variant="secondary" className="w-full justify-center py-2 px-5 text-xs">
            <Check className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )
      case "pending_sent":
        return (
          <Badge variant="secondary" className="w-full justify-center py-2 px-5 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case "pending_received":
        return (
          <Button
            size="sm"
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={handleAccept}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Accept
              </>
            )}
          </Button>
        )
      default:
        return (
          <Button
            size="sm"
            className="w-full bg-[#1358EC] hover:bg-blue-700 text-white"
            onClick={handleAdd}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span className="text-sm font-bold mr-1">+</span>
                Add
              </>
            )}
          </Button>
        )
    }
  }

  return (
    <Card className="bg-white dark:bg-white/5 border border-gray-200 dark:border-gray-200/10 hover:shadow-lg transition-all duration-200">
      <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
        <div className="relative">
          <Link href={`/socialfi/profile/${p.walletAddress}`}>
            <Avatar className="h-16 w-16 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all">
              {pfp ? <AvatarImage src={pfp} alt={displayName} /> : null}
              <AvatarFallback className="bg-blue-600 text-white text-lg">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          {!isMe && myProfileId && (
            <button
              onClick={handleToggleFavorite}
              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-white dark:bg-gray-800 shadow-sm hover:scale-110 transition-transform"
              title={favorited ? "Remove from favourites" : "Add to favourites"}
            >
              <Star
                className={`h-4 w-4 ${
                  favorited
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300 hover:text-yellow-300"
                }`}
              />
            </button>
          )}
        </div>

        <div className="space-y-1">
          <Link href={`/socialfi/profile/${p.walletAddress}`} className="hover:text-blue-600 transition-colors">
            <p className="font-semibold text-sm truncate max-w-[160px]">
              {solDomain || displayName}
            </p>
          </Link>
        </div>

        {renderAction()}
      </CardContent>
    </Card>
  )
}

export function CommunityProfiles({ searchQuery = "" }: { searchQuery?: string }) {
  const { profile: myProfile } = useTapestryProfile()
  const [profiles, setProfiles] = useState<TapestryProfileResponse[]>([])
  const [loading, setLoading] = useState(true)

  const isWalletAddress = (q: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q.trim())

  const loadProfiles = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const q = query.trim()
      if (q && isWalletAddress(q)) {
        const result = await searchProfiles(q, 50, 0)
        setProfiles(result.profiles || [])
      } else if (q) {
        const result = await searchProfiles(undefined, 100, 0)
        const filtered = (result.profiles || []).filter((p) => {
          const name = getCustomProperty(p.profile, "displayName") || p.profile.username || ""
          return name.toLowerCase().includes(q.toLowerCase())
        })
        setProfiles(filtered)
      } else {
        const result = await searchProfiles(undefined, 50, 0)
        setProfiles(result.profiles || [])
      }
    } catch {
      // keep existing
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfiles(searchQuery)
  }, [loadProfiles, searchQuery])

  const myProfileId = myProfile?.profile?.id || null

  if (!isTapestryConfigured()) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-1">Tapestry API not configured</p>
          <p className="text-sm">
            Set <code className="bg-muted px-1 py-0.5 rounded text-xs">TAPESTRY_API_KEY</code> to enable SocialFi.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const filteredProfiles = profiles.filter(
    (p) => p.profile.id !== myProfileId && p.profile.username !== "testuser"
  )

  return (
    <div>
      {filteredProfiles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>{searchQuery ? "No profiles found for this search." : "No profiles found yet. Be the first to join!"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredProfiles.map((p) => (
            <ProfileCard
              key={p.profile.id}
              profile={p}
              myProfileId={myProfileId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
