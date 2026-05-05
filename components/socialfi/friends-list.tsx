"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, UserMinus, Users, Eye, Star } from "lucide-react"
import Link from "next/link"
import { useFriends } from "@/components/friends-provider"
import { getCustomProperty, type TapestryProfileResponse } from "@/lib/tapestry"
import { useSolDomain } from "@/hooks/useSNS"
import { useFavorites } from "@/hooks/useFavorites"
import { toast } from "sonner"

function FriendCard({ profile }: { profile: TapestryProfileResponse }) {
  const { removeFriend } = useFriends()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const p = profile.profile
  const customName = getCustomProperty(p, "displayName")
  const displayName = customName || p.username
  const pfp = getCustomProperty(p, "profileImage") || p.image
  const solDomain = useSolDomain(p.walletAddress)
  const favorited = isFavorite(p.id)

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

  const handleRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true)
      setTimeout(() => setConfirmRemove(false), 3000)
      return
    }
    setRemoving(true)
    const success = await removeFriend(p.id)
    if (success) {
      toast.success(`Removed ${displayName}`)
    } else {
      toast.error("Failed to remove friend")
    }
    setRemoving(false)
    setConfirmRemove(false)
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
          <button
            onClick={handleToggleFavorite}
            className="absolute -top-1 -right-1 hover:scale-110 transition-transform drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
            title={favorited ? "Remove from favourites" : "Add to favourites"}
          >
            <Star
              className={`h-4 w-4 ${
                favorited ? "text-yellow-400 fill-yellow-400" : "text-white/80 hover:text-yellow-300"
              }`}
            />
          </button>
        </div>

        <div className="space-y-1">
          <Link href={`/socialfi/profile/${p.walletAddress}`} className="hover:text-blue-600 transition-colors">
            <p className="font-semibold text-sm truncate max-w-[160px]">
              {solDomain || displayName}
            </p>
          </Link>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <Link href={`/socialfi/profile/${p.walletAddress}`} className="w-full">
            <Button size="sm" className="w-full min-h-[32px] text-xs bg-[#1358EC] hover:bg-blue-700 text-white">
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </Link>
          <Button
            size="sm"
            variant="destructive"
            className="w-full min-h-[36px] py-2 text-xs"
            onClick={handleRemove}
            disabled={removing}
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : confirmRemove ? (
              "Confirm"
            ) : (
              <>
                <UserMinus className="h-4 w-4 mr-1" />
                Disconnect
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function FriendsList({ searchQuery = "" }: { searchQuery?: string }) {
  const { friends, loadingFriends } = useFriends()

  if (loadingFriends) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const filtered = searchQuery
    ? friends.filter((f) => {
        const p = f.profile
        const name = (getCustomProperty(p, "displayName") || p.username || "").toLowerCase()
        const wallet = (p.walletAddress || "").toLowerCase()
        const q = searchQuery.toLowerCase()
        return name.includes(q) || wallet.includes(q)
      })
    : friends

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">{searchQuery ? "No connections found" : "No connections yet"}</p>
          <p className="text-sm">{searchQuery ? "Try a different search." : "Use All Profiles to find and add users."}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {filtered.map((f) => (
        <FriendCard key={f.profile.id} profile={f} />
      ))}
    </div>
  )
}
