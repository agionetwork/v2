"use client"

import { useState, useEffect, useCallback } from "react"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import {
  favoriteProfile,
  unfavoriteProfile,
  getFavoriteProfileIds,
} from "@/lib/tapestry"

export function useFavorites() {
  const { profile } = useTapestryProfile()
  const myProfileId = profile?.profile?.id || null
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadFavorites = useCallback(() => {
    if (!myProfileId) {
      setFavoriteIds(new Set())
      setLoading(false)
      return
    }
    // Load from localStorage (instant, source of truth for the UI)
    const stored = getFavoriteProfileIds(myProfileId)
    setFavoriteIds(new Set(stored))
    setLoading(false)
  }, [myProfileId])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const isFavorite = useCallback(
    (profileId: string) => favoriteIds.has(profileId),
    [favoriteIds]
  )

  const toggleFavorite = useCallback(
    async (targetProfileId: string): Promise<boolean> => {
      if (!myProfileId) return false
      const wasFavorite = favoriteIds.has(targetProfileId)
      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (wasFavorite) next.delete(targetProfileId)
        else next.add(targetProfileId)
        return next
      })
      try {
        if (wasFavorite) {
          await unfavoriteProfile(myProfileId, targetProfileId)
        } else {
          await favoriteProfile(myProfileId, targetProfileId)
        }
        return !wasFavorite // returns new state: true if now favorited
      } catch {
        // Rollback
        setFavoriteIds((prev) => {
          const next = new Set(prev)
          if (wasFavorite) next.add(targetProfileId)
          else next.delete(targetProfileId)
          return next
        })
        return wasFavorite
      }
    },
    [myProfileId, favoriteIds]
  )

  return { favoriteIds, isFavorite, toggleFavorite, loading, refresh: loadFavorites }
}
