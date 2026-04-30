"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import {
  getFriends as apiFetchFriends,
  getReceivedFriendRequests,
  getSentFriendRequests,
  sendFriendRequest as apiSendFriendRequest,
  acceptFriendRequest as apiAcceptFriendRequest,
  rejectFriendRequest as apiRejectFriendRequest,
  unfriend as apiUnfriend,
  getFriendSuggestions as apiGetFriendSuggestions,
  getFriendActivityFeed as apiGetFriendActivityFeed,
  checkFollowStatus,
  followUser,
  isTapestryConfigured,
  type TapestryProfileResponse,
  type FriendRequest,
  type ActivityFeedItem,
} from "@/lib/tapestry"

export type FriendshipStatus = "friend" | "pending_sent" | "pending_received" | "none"

export interface FriendSuggestion {
  profile: TapestryProfileResponse
  mutualCount: number
}

export interface UseFriendsReturn {
  friends: TapestryProfileResponse[]
  receivedRequests: FriendRequest[]
  sentRequests: FriendRequest[]
  acceptedSentRequests: FriendRequest[]
  suggestions: FriendSuggestion[]
  activityFeed: ActivityFeedItem[]

  loadingFriends: boolean
  loadingRequests: boolean
  loadingSuggestions: boolean
  loadingFeed: boolean

  sendRequest: (targetProfileId: string, targetWallet: string) => Promise<boolean>
  acceptRequest: (contentId: string, pairContentId: string, senderProfileId: string) => Promise<boolean>
  rejectRequest: (contentId: string, pairContentId?: string) => Promise<boolean>
  removeFriend: (friendProfileId: string) => Promise<boolean>

  refreshAll: () => Promise<void>
  refreshFeed: () => Promise<void>
  refreshSuggestions: () => Promise<void>

  getFriendshipStatus: (profileId: string) => FriendshipStatus
  verifyFriendship: (profileId: string) => Promise<boolean>
  pendingReceivedCount: number
}

export function useFriendsHook(): UseFriendsReturn {
  const { profile: myProfile } = useTapestryProfile()
  const myProfileId = myProfile?.profile?.id || null
  const myWallet = myProfile?.profile?.walletAddress || null
  const isLocal = myProfileId?.startsWith("local_")

  const [friends, setFriends] = useState<TapestryProfileResponse[]>([])
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [acceptedSentRequests, setAcceptedSentRequests] = useState<FriendRequest[]>([])
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([])

  const [loadingFriends, setLoadingFriends] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingFeed, setLoadingFeed] = useState(false)

  const loadFriends = useCallback(async () => {
    if (!myProfileId || isLocal) return
    setLoadingFriends(true)
    try {
      const result = await apiFetchFriends(myProfileId)
      setFriends(result)
    } catch {
      // keep existing
    } finally {
      setLoadingFriends(false)
    }
  }, [myProfileId, isLocal])

  const loadRequests = useCallback(async () => {
    if (!myProfileId || isLocal) return
    setLoadingRequests(true)
    try {
      const [received, sent, acceptedSent] = await Promise.all([
        getReceivedFriendRequests(myProfileId, "pending"),
        getSentFriendRequests(myProfileId, "pending"),
        getSentFriendRequests(myProfileId, "accepted"),
      ])
      // Deduplicate: keep only the latest request per sender/target pair
      const dedupeByKey = (reqs: FriendRequest[], keyFn: (r: FriendRequest) => string) => {
        const seen = new Set<string>()
        return reqs.filter((r) => {
          const key = keyFn(r)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      }
      setReceivedRequests(dedupeByKey(received, (r) => r.senderProfileId))
      setSentRequests(dedupeByKey(sent, (r) => r.targetProfileId))
      setAcceptedSentRequests(dedupeByKey(acceptedSent, (r) => r.targetProfileId))
    } catch {
      // keep existing
    } finally {
      setLoadingRequests(false)
    }
  }, [myProfileId, isLocal])

  const loadFeed = useCallback(async () => {
    if (friends.length === 0) {
      setActivityFeed([])
      return
    }
    setLoadingFeed(true)
    try {
      const friendIds = friends.map((f) => f.profile.id)
      const feed = await apiGetFriendActivityFeed(friendIds)
      setActivityFeed(feed)
    } catch {
      // keep existing
    } finally {
      setLoadingFeed(false)
    }
  }, [friends])

  const loadSuggestions = useCallback(async () => {
    if (!myProfileId || isLocal) {
      setSuggestions([])
      return
    }
    setLoadingSuggestions(true)
    try {
      const existingFriendIds = new Set(friends.map((f) => f.profile.id))
      const pendingTargetIds = new Set(sentRequests.map((r) => r.targetProfileId))
      const result = await apiGetFriendSuggestions(myProfileId, existingFriendIds, pendingTargetIds)
      setSuggestions(result)
    } catch {
      // keep existing
    } finally {
      setLoadingSuggestions(false)
    }
  }, [myProfileId, isLocal, friends, sentRequests])

  // Initial load
  useEffect(() => {
    if (myProfileId && !isLocal && isTapestryConfigured()) {
      loadFriends()
      loadRequests()
    }
  }, [myProfileId, isLocal, loadFriends, loadRequests])

  // Load feed when friends change
  useEffect(() => {
    if (friends.length > 0) {
      loadFeed()
    }
  }, [friends, loadFeed])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadFriends(), loadRequests()])
  }, [loadFriends, loadRequests])

  const refreshFeed = useCallback(async () => {
    await loadFeed()
  }, [loadFeed])

  const refreshSuggestions = useCallback(async () => {
    await loadSuggestions()
  }, [loadSuggestions])

  const verifyFriendship = useCallback(
    async (profileId: string): Promise<boolean> => {
      if (!myProfileId || isLocal) return false
      try {
        const [iFollow, theyFollow] = await Promise.all([
          checkFollowStatus(myProfileId, profileId),
          checkFollowStatus(profileId, myProfileId),
        ])
        return iFollow.isFollowing && theyFollow.isFollowing
      } catch {
        return false
      }
    },
    [myProfileId, isLocal]
  )

  const sendRequest = useCallback(
    async (targetProfileId: string, targetWallet: string): Promise<boolean> => {
      if (!myProfileId || !myWallet || isLocal) return false
      // Quick check: if already mutual followers, skip sending request
      const alreadyFriends = await verifyFriendship(targetProfileId)
      if (alreadyFriends) {
        await loadFriends()
        return false
      }
      // Skip if a pending request already exists for this target
      if (sentRequests.some((r) => r.targetProfileId === targetProfileId)) return false
      const result = await apiSendFriendRequest(myProfileId, targetProfileId, myWallet, targetWallet)
      if (result) {
        // Notify target via Dialect (fire-and-forget)
        fetch("/api/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "friend_request",
            recipientWallet: targetWallet,
            senderName: myProfileId,
          }),
        }).catch(() => {})
        await loadRequests()
        return true
      }
      return false
    },
    [myProfileId, myWallet, isLocal, loadRequests, loadFriends, verifyFriendship, sentRequests]
  )

  const acceptRequest = useCallback(
    async (contentId: string, pairContentId: string, senderProfileId: string): Promise<boolean> => {
      if (!myProfileId) return false
      const success = await apiAcceptFriendRequest(contentId, pairContentId, myProfileId, senderProfileId)
      if (success) {
        // Verify mutual follows were created; repair if needed
        const isMutual = await verifyFriendship(senderProfileId)
        if (!isMutual) {
          try {
            const [iFollow, theyFollow] = await Promise.all([
              checkFollowStatus(myProfileId, senderProfileId),
              checkFollowStatus(senderProfileId, myProfileId),
            ])
            const repairs: Promise<any>[] = []
            if (!iFollow.isFollowing) repairs.push(followUser(myProfileId, senderProfileId))
            if (!theyFollow.isFollowing) repairs.push(followUser(senderProfileId, myProfileId))
            if (repairs.length > 0) await Promise.all(repairs)
          } catch {
            // best-effort repair
          }
        }
        // Notify sender via Dialect that request was accepted (fire-and-forget)
        const senderReq = receivedRequests.find((r) => r.senderProfileId === senderProfileId)
        if (senderReq?.senderWallet) {
          fetch("/api/notifications/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "friend_accepted",
              recipientWallet: senderReq.senderWallet,
              senderName: myProfileId,
            }),
          }).catch(() => {})
        }
        await Promise.all([loadFriends(), loadRequests()])
        return true
      }
      return false
    },
    [myProfileId, loadFriends, loadRequests, verifyFriendship, receivedRequests]
  )

  const rejectRequest = useCallback(
    async (contentId: string, pairContentId?: string): Promise<boolean> => {
      const success = await apiRejectFriendRequest(contentId, pairContentId)
      if (success) {
        await loadRequests()
        return true
      }
      return false
    },
    [loadRequests]
  )

  const removeFriend = useCallback(
    async (friendProfileId: string): Promise<boolean> => {
      if (!myProfileId) return false
      const success = await apiUnfriend(myProfileId, friendProfileId)
      if (success) {
        await loadFriends()
        return true
      }
      return false
    },
    [myProfileId, loadFriends]
  )

  // Build lookup sets for friendship status
  const friendIdSet = useMemo(() => new Set(friends.map((f) => f.profile.id)), [friends])
  const sentTargetSet = useMemo(() => new Set(sentRequests.map((r) => r.targetProfileId)), [sentRequests])
  const receivedSenderSet = useMemo(() => new Set(receivedRequests.map((r) => r.senderProfileId)), [receivedRequests])

  const getFriendshipStatus = useCallback(
    (profileId: string): FriendshipStatus => {
      if (friendIdSet.has(profileId)) return "friend"
      if (sentTargetSet.has(profileId)) return "pending_sent"
      if (receivedSenderSet.has(profileId)) return "pending_received"
      return "none"
    },
    [friendIdSet, sentTargetSet, receivedSenderSet]
  )

  const pendingReceivedCount = receivedRequests.length

  return {
    friends,
    receivedRequests,
    sentRequests,
    acceptedSentRequests,
    suggestions,
    activityFeed,
    loadingFriends,
    loadingRequests,
    loadingSuggestions,
    loadingFeed,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    refreshAll,
    refreshFeed,
    refreshSuggestions,
    getFriendshipStatus,
    verifyFriendship,
    pendingReceivedCount,
  }
}
