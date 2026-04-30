// API key is now server-side only (app/api/tapestry/route.ts)
const TAPESTRY_PROXY_URL = "/api/tapestry"
const TAPESTRY_NAMESPACE = "agionetwork"

interface TapestryProfile {
  id: string
  username: string
  walletAddress: string
  blockchain: string
  namespace?: string
  bio?: string | null
  image?: string | null
  properties: { key: string; value: string }[]
  created_at?: number
}

interface TapestryProfileResponse {
  profile: TapestryProfile
  walletAddress?: string
  wallet?: { address: string }
  socialCounts?: {
    followers: number
    following: number
  }
}

interface TapestryFollowCheck {
  isFollowing: boolean
}

interface TapestrySearchResult {
  profiles: TapestryProfileResponse[]
}

let _tapestryConfigured: boolean | null = null

async function checkTapestryConfigured(): Promise<boolean> {
  if (_tapestryConfigured !== null) return _tapestryConfigured
  try {
    const res = await fetch(TAPESTRY_PROXY_URL)
    const data = await res.json()
    _tapestryConfigured = !!data.configured
  } catch {
    _tapestryConfigured = false
  }
  return _tapestryConfigured
}

function isTapestryConfigured(): boolean {
  return _tapestryConfigured !== false
}

// Standard profile fields that are NOT custom properties
const STANDARD_PROFILE_FIELDS = new Set([
  "id", "username", "walletAddress", "blockchain", "namespace",
  "image", "properties", "created_at", "wallet",
])

// Normalize API response: ensure profile.walletAddress and profile.properties exist.
// Tapestry API returns custom properties as top-level fields on the profile object,
// so we collect them into the properties array for consistent access via getCustomProperty().
// Also handles FLAT profile format from followers/following API: { id, username, wallet: { id } }
function normalizeProfileResponse(data: any): TapestryProfileResponse {
  // Detect flat profile format (followers/following API returns profiles without .profile wrapper)
  const isFlatProfile = !data.profile && data.id
  const profile = isFlatProfile ? data : (data.profile || {})

  // Collect existing properties array
  const existingProps: { key: string; value: string }[] = profile.properties || []
  const existingKeys = new Set(existingProps.map((p: any) => p.key))

  // Extract custom properties from top-level profile fields
  for (const [key, value] of Object.entries(profile)) {
    if (!STANDARD_PROFILE_FIELDS.has(key) && !existingKeys.has(key) && typeof value === "string") {
      existingProps.push({ key, value })
    }
  }

  // Resolve walletAddress from multiple possible locations
  const walletAddress =
    profile.walletAddress ||
    data.walletAddress ||
    data.wallet?.address ||
    data.wallet?.id ||
    profile.wallet?.id ||
    ""

  return {
    ...(isFlatProfile ? {} : data),
    profile: {
      ...profile,
      walletAddress,
      blockchain: profile.blockchain || data.wallet?.blockchain || profile.wallet?.blockchain || "SOLANA",
      properties: existingProps,
    },
  }
}

function normalizeSearchResult(data: any): TapestrySearchResult {
  const profiles = (data.profiles || []).map(normalizeProfileResponse)
  return { profiles }
}

async function tapestryFetch(path: string, options?: RequestInit) {
  const method = options?.method || "GET"
  const body = options?.body ? JSON.parse(options.body as string) : undefined

  const res = await fetch(TAPESTRY_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, method, body }),
  })

  if (!res.ok) {
    throw new Error(`Tapestry proxy error ${res.status}`)
  }

  return res.json()
}

// --- Profiles ---

export async function findOrCreateProfile(
  walletAddress: string,
  username?: string
): Promise<TapestryProfileResponse | null> {
  if (!isTapestryConfigured()) {
    console.warn("Tapestry API key not configured. Skipping profile creation.")
    return null
  }
  const data = await tapestryFetch("/profiles/findOrCreate", {
    method: "POST",
    body: JSON.stringify({
      walletAddress,
      username: username || walletAddress.slice(0, 8),
      blockchain: "SOLANA",
      execution: "FAST_UNCONFIRMED",
    }),
  })
  return normalizeProfileResponse(data)
}

export async function getProfile(profileId: string): Promise<TapestryProfileResponse> {
  const data = await tapestryFetch(`/profiles/${profileId}`)
  return normalizeProfileResponse(data)
}

export async function updateProfile(
  profileId: string,
  properties: { key: string; value: string }[]
): Promise<TapestryProfileResponse> {
  const data = await tapestryFetch(`/profiles/${profileId}`, {
    method: "PUT",
    body: JSON.stringify({
      properties,
      execution: "FAST_UNCONFIRMED",
    }),
  })
  return normalizeProfileResponse(data)
}

export async function searchProfiles(
  walletAddress?: string,
  limit = 50,
  offset = 0
): Promise<TapestrySearchResult> {
  if (!isTapestryConfigured()) {
    return { profiles: [] }
  }
  const params = new URLSearchParams()
  if (walletAddress) params.set("walletAddress", walletAddress)
  params.set("namespace", TAPESTRY_NAMESPACE)
  const startPage = Math.floor(offset / limit) + 1
  params.set("page", String(startPage))
  params.set("pageSize", String(limit))

  const data = await tapestryFetch(`/profiles/?${params.toString()}`)
  const result = normalizeSearchResult(data)

  // Auto-paginate: if API returned fewer than totalCount, fetch remaining pages
  const totalCount = data.totalCount ?? result.profiles.length
  if (totalCount > result.profiles.length && result.profiles.length > 0) {
    const totalPages = Math.ceil(totalCount / limit)
    const fetches: Promise<TapestrySearchResult>[] = []
    for (let page = startPage + 1; page <= totalPages; page++) {
      const p = new URLSearchParams(params)
      p.set("page", String(page))
      fetches.push(
        tapestryFetch(`/profiles/?${p.toString()}`).then(normalizeSearchResult)
      )
    }
    const pages = await Promise.allSettled(fetches)
    for (const pg of pages) {
      if (pg.status === "fulfilled") {
        result.profiles.push(...pg.value.profiles)
      }
    }
  }

  return result
}

// Search for profiles of a wallet across ALL Tapestry namespaces (cross-app discovery)
export async function searchProfilesCrossApp(
  walletAddress: string
): Promise<TapestryProfileResponse[]> {
  if (!isTapestryConfigured()) return []
  try {
    const params = new URLSearchParams()
    params.set("walletAddress", walletAddress)
    params.set("pageSize", "10")
    const data = await tapestryFetch(`/profiles/?${params.toString()}`)
    const result = normalizeSearchResult(data)
    // Exclude profiles from our own namespace — we want profiles from OTHER apps
    return (result.profiles || []).filter(
      (p) => p.profile.namespace && p.profile.namespace !== TAPESTRY_NAMESPACE
    )
  } catch {
    return []
  }
}

// Check if a displayName is already taken by another wallet
export async function checkUsernameAvailable(
  displayName: string,
  currentWalletAddress: string
): Promise<boolean> {
  if (!isTapestryConfigured() || !displayName.trim()) return true
  try {
    const result = await searchProfiles(undefined, 100, 0)
    const taken = result.profiles.some((p) => {
      const name = getCustomProperty(p.profile, "displayName") || p.profile.username
      return (
        name.toLowerCase() === displayName.trim().toLowerCase() &&
        p.profile.walletAddress.toLowerCase() !== currentWalletAddress.toLowerCase()
      )
    })
    return !taken
  } catch {
    return true // allow on error
  }
}

// --- Followers ---

export async function followUser(startId: string, endId: string): Promise<void> {
  await tapestryFetch("/followers/add", {
    method: "POST",
    body: JSON.stringify({ startId, endId }),
  })
}

export async function unfollowUser(startId: string, endId: string): Promise<void> {
  await tapestryFetch("/followers/remove", {
    method: "POST",
    body: JSON.stringify({ startId, endId }),
  })
}

export async function checkFollowStatus(
  startId: string,
  endId: string
): Promise<TapestryFollowCheck> {
  return tapestryFetch(`/followers/state?startId=${startId}&endId=${endId}`)
}

export async function getFollowers(
  profileId: string,
  limit = 20,
  page = 1
): Promise<{ profiles: TapestryProfileResponse[]; page: number; pageSize: number }> {
  return tapestryFetch(`/profiles/${profileId}/followers?page=${page}&pageSize=${limit}`)
}

export async function getFollowing(
  profileId: string,
  limit = 20,
  page = 1
): Promise<{ profiles: TapestryProfileResponse[]; page: number; pageSize: number }> {
  return tapestryFetch(`/profiles/${profileId}/following?page=${page}&pageSize=${limit}`)
}

// --- Content / Activity Feed ---

// Tapestry returns content properties as flat fields on the content object
// (same pattern as profile custom properties)
interface TapestryContent {
  id: string
  profileId?: string
  created_at?: number
  [key: string]: any
}

interface TapestryContentResponse {
  authorProfile?: any
  content: TapestryContent
  socialCounts?: any
}

export async function createContent(
  profileId: string,
  contentId: string,
  properties?: { key: string; value: string }[]
): Promise<TapestryContentResponse> {
  return tapestryFetch("/contents/findOrCreate", {
    method: "POST",
    body: JSON.stringify({
      id: contentId,
      profileId,
      properties: properties || [],
    }),
  })
}

export async function getContents(
  options: {
    profileId?: string
    namespace?: string
    filterField?: string
    filterValue?: string
    page?: number
    pageSize?: number
  } = {}
): Promise<{ contents: TapestryContentResponse[] }> {
  const params = new URLSearchParams()
  if (options.profileId) params.set("profileId", options.profileId)
  if (options.namespace) params.set("namespace", options.namespace)
  if (options.filterField) params.set("filterField", options.filterField)
  if (options.filterValue) params.set("filterValue", options.filterValue)
  params.set("page", String(options.page || 1))
  params.set("pageSize", String(options.pageSize || 20))

  return tapestryFetch(`/contents/?${params.toString()}`)
}

// Post a loan event as social activity
export async function postLoanActivity(
  profileId: string,
  event: "created" | "accepted" | "repaid" | "foreclosed",
  details: {
    loanType?: string
    debtToken?: string
    collateralToken?: string
    amount?: number
    collateralAmount?: number
    apy?: number
    duration?: number // seconds
    txSignature?: string
  }
): Promise<TapestryContentResponse | null> {
  if (!isTapestryConfigured() || !profileId || profileId.startsWith("local_")) {
    return null
  }

  const contentId = `loan_${event}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const messages: Record<string, string> = {
    created: `Created a ${details.loanType || "loan"} offer: ${details.amount} ${details.debtToken} at ${details.apy}% APY`,
    accepted: `Accepted a loan: ${details.amount} ${details.debtToken} at ${details.apy}% APY`,
    repaid: `Repaid a loan: ${details.amount} ${details.debtToken}`,
    foreclosed: `Foreclosed a loan: ${details.amount} ${details.debtToken}`,
  }

  const properties = [
    { key: "eventType", value: `loan_${event}` },
    { key: "message", value: messages[event] },
    ...(details.debtToken ? [{ key: "debtToken", value: details.debtToken }] : []),
    ...(details.collateralToken ? [{ key: "collateralToken", value: details.collateralToken }] : []),
    ...(details.amount ? [{ key: "amount", value: String(details.amount) }] : []),
    ...(details.collateralAmount ? [{ key: "collateralAmount", value: String(details.collateralAmount) }] : []),
    ...(details.apy ? [{ key: "apy", value: String(details.apy) }] : []),
    ...(details.duration ? [{ key: "duration", value: String(details.duration) }] : []),
    ...(details.txSignature ? [{ key: "txSignature", value: details.txSignature }] : []),
  ]

  try {
    return await createContent(profileId, contentId, properties)
  } catch (err) {
    console.error("Failed to post loan activity:", err)
    return null
  }
}

export type { TapestryContent, TapestryContentResponse }

// Resolve multiple wallet addresses to Tapestry profiles
export async function resolveWalletProfiles(
  walletAddresses: string[]
): Promise<Map<string, TapestryProfileResponse>> {
  const map = new Map<string, TapestryProfileResponse>()
  if (!isTapestryConfigured() || walletAddresses.length === 0) return map

  await Promise.allSettled(
    walletAddresses.map((addr) =>
      tapestryFetch(`/profiles/?walletAddress=${addr}&namespace=${TAPESTRY_NAMESPACE}&pageSize=1`)
        .then((data: any) => {
          const result = normalizeSearchResult(data)
          if (result.profiles?.[0]) {
            map.set(addr, result.profiles[0])
          }
        })
    )
  )

  // Fallback: for unresolved wallets, check if they are agent wallets and resolve owner profiles
  const unresolved = walletAddresses.filter((addr) => !map.has(addr))
  if (unresolved.length > 0) {
    try {
      const res = await fetch("/api/agent-owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallets: unresolved }),
      })
      const { mapping } = (await res.json()) as { mapping: Record<string, string | null> }

      // Collect unique owner wallets that we don't already have
      const ownerWallets = new Set<string>()
      for (const [, owner] of Object.entries(mapping)) {
        if (owner && !map.has(owner)) ownerWallets.add(owner)
      }

      // Resolve owner profiles
      if (ownerWallets.size > 0) {
        await Promise.allSettled(
          Array.from(ownerWallets).map((ownerAddr) =>
            tapestryFetch(`/profiles/?walletAddress=${ownerAddr}&namespace=${TAPESTRY_NAMESPACE}&pageSize=1`)
              .then((data: any) => {
                const result = normalizeSearchResult(data)
                if (result.profiles?.[0]) {
                  map.set(ownerAddr, result.profiles[0])
                }
              })
          )
        )
      }

      // Map agent wallets to their owner's profile
      for (const [agentWallet, owner] of Object.entries(mapping)) {
        if (owner && map.has(owner)) {
          map.set(agentWallet, map.get(owner)!)
        }
      }
    } catch { /* fallback — agent wallets just won't have profiles */ }
  }

  return map
}

// Helper to extract custom property value from profile
export function getCustomProperty(
  profile: TapestryProfile,
  key: string
): string | undefined {
  return profile.properties?.find((p) => p.key === key)?.value
}

// --- Friend Requests (built on Content API) ---

// Helper to extract property from content item (flat fields)
export function getContentProperty(
  content: TapestryContent,
  key: string
): string | undefined {
  const val = content[key]
  return val !== undefined && val !== null ? String(val) : undefined
}

export async function updateContent(
  contentId: string,
  properties: { key: string; value: string }[]
): Promise<TapestryContentResponse> {
  return tapestryFetch(`/contents/${contentId}`, {
    method: "PUT",
    body: JSON.stringify({ properties }),
  })
}

export interface FriendRequest {
  contentId: string
  pairContentId: string
  senderProfileId: string
  targetProfileId: string
  senderWallet: string
  targetWallet: string
  status: "pending" | "accepted" | "rejected"
  createdAt: string
}

function parseContentToFriendRequest(c: TapestryContentResponse): FriendRequest | null {
  const ct = c.content
  const eventType = ct.eventType
  if (eventType !== "friend_request_sent" && eventType !== "friend_request_received") return null
  return {
    contentId: ct.id,
    pairContentId: ct.pairContentId || "",
    senderProfileId: ct.senderProfileId || "",
    targetProfileId: ct.targetProfileId || "",
    senderWallet: ct.senderWallet || "",
    targetWallet: ct.targetWallet || "",
    status: (ct.status as FriendRequest["status"]) || "pending",
    createdAt: ct.created_at ? new Date(ct.created_at).toISOString() : "",
  }
}

export async function sendFriendRequest(
  senderProfileId: string,
  targetProfileId: string,
  senderWallet: string,
  targetWallet: string
): Promise<TapestryContentResponse | null> {
  if (!isTapestryConfigured() || !senderProfileId || senderProfileId.startsWith("local_")) {
    return null
  }
  const ts = Date.now()
  const sentId = `fr_sent_${senderProfileId}_${targetProfileId}_${ts}`
  const recvId = `fr_recv_${senderProfileId}_${targetProfileId}_${ts}`

  const baseProps = [
    { key: "senderProfileId", value: senderProfileId },
    { key: "targetProfileId", value: targetProfileId },
    { key: "senderWallet", value: senderWallet },
    { key: "targetWallet", value: targetWallet },
    { key: "status", value: "pending" },
  ]

  try {
    // Create content under sender's profile (for sent tracking)
    const sentResult = await createContent(senderProfileId, sentId, [
      { key: "eventType", value: "friend_request_sent" },
      { key: "pairContentId", value: recvId },
      ...baseProps,
    ])
    // Create content under target's profile (for received tracking)
    await createContent(targetProfileId, recvId, [
      { key: "eventType", value: "friend_request_received" },
      { key: "pairContentId", value: sentId },
      ...baseProps,
    ])
    return sentResult
  } catch (err) {
    console.error("Failed to send friend request:", err)
    return null
  }
}

export async function acceptFriendRequest(
  contentId: string,
  pairContentId: string,
  myProfileId: string,
  senderProfileId: string
): Promise<boolean> {
  try {
    // Update both content items to "accepted"
    await Promise.all([
      updateContent(contentId, [{ key: "status", value: "accepted" }]),
      pairContentId ? updateContent(pairContentId, [{ key: "status", value: "accepted" }]) : Promise.resolve(),
    ])
    // Create mutual follows (friendship = mutual follow)
    await Promise.all([
      followUser(myProfileId, senderProfileId),
      followUser(senderProfileId, myProfileId),
    ])
    return true
  } catch (err) {
    console.error("Failed to accept friend request:", err)
    return false
  }
}

export async function rejectFriendRequest(
  contentId: string,
  pairContentId?: string
): Promise<boolean> {
  try {
    await Promise.all([
      updateContent(contentId, [{ key: "status", value: "rejected" }]),
      pairContentId ? updateContent(pairContentId, [{ key: "status", value: "rejected" }]) : Promise.resolve(),
    ])
    return true
  } catch (err) {
    console.error("Failed to reject friend request:", err)
    return false
  }
}

export async function getReceivedFriendRequests(
  profileId: string,
  status?: "pending" | "accepted" | "rejected"
): Promise<FriendRequest[]> {
  if (!isTapestryConfigured()) return []
  try {
    const result = await getContents({
      profileId,
      pageSize: 100,
    })
    let items = (result.contents || [])
      .map(parseContentToFriendRequest)
      .filter((r): r is FriendRequest => r !== null && r.targetProfileId === profileId)
    if (status) {
      items = items.filter((r) => r.status === status)
    }
    return items
  } catch {
    return []
  }
}

export async function getSentFriendRequests(
  profileId: string,
  status?: "pending" | "accepted" | "rejected"
): Promise<FriendRequest[]> {
  if (!isTapestryConfigured()) return []
  try {
    const result = await getContents({
      profileId,
      pageSize: 100,
    })
    let items = (result.contents || [])
      .map(parseContentToFriendRequest)
      .filter((r): r is FriendRequest => r !== null && r.senderProfileId === profileId)
    if (status) {
      items = items.filter((r) => r.status === status)
    }
    return items
  } catch {
    return []
  }
}

// Friends = mutual follows (intersection of following and followers)
// Enriches profiles by fetching full data (custom properties like displayName, profileImage)
export async function getFriends(
  profileId: string
): Promise<TapestryProfileResponse[]> {
  if (!isTapestryConfigured()) return []
  try {
    const [followingRes, followersRes] = await Promise.all([
      getFollowing(profileId, 100, 1),
      getFollowers(profileId, 100, 1),
    ])
    const followingIds = new Set(
      (followingRes.profiles || []).map((p: any) => p.profile?.id || p.id)
    )
    const mutualFollowers = (followersRes.profiles || [])
      .map(normalizeProfileResponse)
      .filter((p: TapestryProfileResponse) => followingIds.has(p.profile.id))

    // Fetch full profiles to get custom properties (displayName, profileImage, etc.)
    const enriched = await Promise.allSettled(
      mutualFollowers.map((f) => getProfile(f.profile.id))
    )
    return enriched
      .filter((r): r is PromiseFulfilledResult<TapestryProfileResponse> => r.status === "fulfilled")
      .map((r) => r.value)
  } catch {
    return []
  }
}

export async function unfriend(
  myProfileId: string,
  friendProfileId: string
): Promise<boolean> {
  try {
    await Promise.all([
      unfollowUser(myProfileId, friendProfileId),
      unfollowUser(friendProfileId, myProfileId),
    ])
    return true
  } catch (err) {
    console.error("Failed to unfriend:", err)
    return false
  }
}

export async function getFriendSuggestions(
  profileId: string,
  existingFriendIds: Set<string>,
  pendingRequestTargetIds: Set<string>
): Promise<{ profile: TapestryProfileResponse; mutualCount: number }[]> {
  if (!isTapestryConfigured()) return []
  try {
    const myFriends = await getFriends(profileId)
    const suggestions = new Map<string, { profile: TapestryProfileResponse; mutualCount: number }>()
    const friendsToQuery = myFriends.slice(0, 10)

    await Promise.allSettled(
      friendsToQuery.map(async (friend) => {
        const fof = await getFriends(friend.profile.id)
        for (const candidate of fof) {
          const cId = candidate.profile.id
          if (
            cId === profileId ||
            existingFriendIds.has(cId) ||
            pendingRequestTargetIds.has(cId)
          ) continue
          const existing = suggestions.get(cId)
          if (existing) {
            existing.mutualCount += 1
          } else {
            suggestions.set(cId, { profile: candidate, mutualCount: 1 })
          }
        }
      })
    )
    return Array.from(suggestions.values()).sort((a, b) => b.mutualCount - a.mutualCount)
  } catch {
    return []
  }
}

export interface ActivityFeedItem {
  contentId: string
  profileId: string
  message: string
  eventType: string
  debtToken?: string
  collateralToken?: string
  amount?: string
  collateralAmount?: string
  apy?: string
  duration?: string // seconds
  txSignature?: string
  createdAt: string
}

function parseContentToActivity(c: TapestryContentResponse): ActivityFeedItem | null {
  const ct = c.content
  const eventType = ct.eventType
  if (!eventType || !eventType.startsWith("loan_created")) return null
  return {
    contentId: ct.id,
    profileId: ct.profileId || c.authorProfile?.id || "",
    message: ct.message || "",
    eventType,
    debtToken: ct.debtToken,
    collateralToken: ct.collateralToken,
    amount: ct.amount ? String(ct.amount) : undefined,
    collateralAmount: ct.collateralAmount ? String(ct.collateralAmount) : undefined,
    apy: ct.apy ? String(ct.apy) : undefined,
    duration: ct.duration ? String(ct.duration) : undefined,
    txSignature: ct.txSignature,
    createdAt: ct.created_at ? new Date(ct.created_at).toISOString() : "",
  }
}

export async function getFriendActivityFeed(
  friendProfileIds: string[],
  pageSize = 20
): Promise<ActivityFeedItem[]> {
  if (!isTapestryConfigured() || friendProfileIds.length === 0) return []
  try {
    const results = await Promise.allSettled(
      friendProfileIds.slice(0, 20).map((fid) =>
        getContents({
          profileId: fid,
          filterField: "eventType",
          filterValue: "loan_created",
          pageSize: 10,
        })
      )
    )
    const allItems: ActivityFeedItem[] = []
    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const c of result.value.contents || []) {
          const item = parseContentToActivity(c)
          if (item) allItems.push(item)
        }
      }
    }
    // Deduplicate by contentId (API may return same content across friend queries)
    const seen = new Set<string>()
    const unique = allItems.filter(item => {
      if (seen.has(item.contentId)) return false
      seen.add(item.contentId)
      return true
    })
    unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return unique.slice(0, pageSize)
  } catch {
    return []
  }
}

// --- Favourites (built on Likes API) ---
// Each target profile gets a content node "profile_fav_{targetProfileId}".
// Liking that content node = favouriting the profile.
// GET /likes/{contentId} returns {profiles: [...], total: N} — who liked it.
// Since there's no "get all things a user liked" endpoint, we persist
// the index in localStorage and sync on each like/unlike.

const FAV_PREFIX = "profile_fav_"
const FAV_STORAGE_KEY = "agio_favourites_"

function getFavStorageKey(myProfileId: string) {
  return `${FAV_STORAGE_KEY}${myProfileId}`
}

/** Load favourite IDs from localStorage */
export function loadFavoriteIdsFromStorage(myProfileId: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(getFavStorageKey(myProfileId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Save favourite IDs to localStorage */
function saveFavoriteIdsToStorage(myProfileId: string, ids: string[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(getFavStorageKey(myProfileId), JSON.stringify(ids))
  } catch { /* quota exceeded — ignore */ }
}

/** Ensure the content node for a target profile exists (so it can be liked) */
async function ensureFavContentNode(myProfileId: string, targetProfileId: string) {
  const contentId = `${FAV_PREFIX}${targetProfileId}`
  await createContent(myProfileId, contentId, [
    { key: "eventType", value: "profile_fav_target" },
    { key: "targetProfileId", value: targetProfileId },
  ])
}

export async function favoriteProfile(myProfileId: string, targetProfileId: string): Promise<void> {
  // 1. Update localStorage optimistically (so UI stays consistent even if API lags)
  const ids = new Set(loadFavoriteIdsFromStorage(myProfileId))
  ids.add(targetProfileId)
  saveFavoriteIdsToStorage(myProfileId, Array.from(ids))
  // 2. Ensure content node exists, then like it
  await ensureFavContentNode(myProfileId, targetProfileId)
  const contentId = `${FAV_PREFIX}${targetProfileId}`
  await tapestryFetch(`/likes/${contentId}`, {
    method: "POST",
    body: JSON.stringify({ startId: myProfileId }),
  })
}

export async function unfavoriteProfile(myProfileId: string, targetProfileId: string): Promise<void> {
  // 1. Update localStorage optimistically
  const ids = new Set(loadFavoriteIdsFromStorage(myProfileId))
  ids.delete(targetProfileId)
  saveFavoriteIdsToStorage(myProfileId, Array.from(ids))
  // 2. DELETE /likes/{contentId} with {"startId": myProfileId}
  const contentId = `${FAV_PREFIX}${targetProfileId}`
  try {
    await tapestryFetch(`/likes/${contentId}`, {
      method: "DELETE",
      body: JSON.stringify({ startId: myProfileId }),
    })
  } catch {
    // May not exist — ignore
  }
}

/** Check if myProfileId has liked the target's content node */
export async function checkFavorite(myProfileId: string, targetProfileId: string): Promise<boolean> {
  const contentId = `${FAV_PREFIX}${targetProfileId}`
  try {
    const data = await tapestryFetch(`/likes/${contentId}`)
    const profiles: any[] = data?.profiles || []
    return profiles.some((p: any) => {
      const id = p.profile?.id || p.id || ""
      return id === myProfileId
    })
  } catch {
    return false
  }
}

/**
 * Get all favourite profile IDs.
 * Returns from localStorage (instant), then optionally verifies against API.
 */
export function getFavoriteProfileIds(myProfileId: string): string[] {
  return loadFavoriteIdsFromStorage(myProfileId)
}

export { isTapestryConfigured, checkTapestryConfigured }
export type { TapestryProfile, TapestryProfileResponse, TapestryFollowCheck }
