"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Star } from "lucide-react"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import { getProfile, type TapestryProfileResponse } from "@/lib/tapestry"
import { useFavorites } from "@/hooks/useFavorites"
import { ProfileCard as CommunityProfileCard } from "@/components/socialfi/community-profiles"

export function FavouriteProfiles() {
  const { profile: myProfile } = useTapestryProfile()
  const { favoriteIds, loading: favLoading } = useFavorites()
  const [profiles, setProfiles] = useState<TapestryProfileResponse[]>([])
  const [loading, setLoading] = useState(true)

  const myProfileId = myProfile?.profile?.id || null

  const loadFavouriteProfiles = useCallback(async () => {
    if (favLoading) return
    if (favoriteIds.size === 0) {
      setProfiles([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const results = await Promise.allSettled(
        Array.from(favoriteIds).map((id) => getProfile(id))
      )
      const resolved = results
        .filter((r): r is PromiseFulfilledResult<TapestryProfileResponse> => r.status === "fulfilled")
        .map((r) => r.value)
      setProfiles(resolved)
    } catch {
      // keep existing
    } finally {
      setLoading(false)
    }
  }, [favoriteIds, favLoading])

  useEffect(() => {
    loadFavouriteProfiles()
  }, [loadFavouriteProfiles])

  if (favLoading || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No favourite profiles yet.</p>
          <p className="text-sm mt-1">Star profiles in All Profiles to add them here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {profiles.map((p) => (
        <CommunityProfileCard
          key={p.profile.id}
          profile={p}
          myProfileId={myProfileId}
        />
      ))}
    </div>
  )
}
