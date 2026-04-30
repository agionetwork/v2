/**
 * Server-side Tapestry API client.
 * Unlike lib/tapestry.ts (which proxies through /api/tapestry for browser use),
 * this module calls the Tapestry API directly using the server-side API key.
 * Used by MCP tools and other server-side code.
 */

const TAPESTRY_API_URL = process.env.TAPESTRY_API_URL || "https://api.usetapestry.dev/api/v1"
const TAPESTRY_API_KEY = process.env.TAPESTRY_API_KEY || ""
const TAPESTRY_NAMESPACE = "agionetwork"

// --- Types (shared with lib/tapestry.ts) ---

export interface TapestryProfile {
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

export interface TapestryProfileResponse {
  profile: TapestryProfile
  walletAddress?: string
  wallet?: { address: string }
  socialCounts?: {
    followers: number
    following: number
  }
}

// Standard profile fields that are NOT custom properties
const STANDARD_PROFILE_FIELDS = new Set([
  "id", "username", "walletAddress", "blockchain", "namespace",
  "image", "properties", "created_at", "wallet",
])

function normalizeProfileResponse(data: any): TapestryProfileResponse {
  const isFlatProfile = !data.profile && data.id
  const profile = isFlatProfile ? data : (data.profile || {})

  const existingProps: { key: string; value: string }[] = profile.properties || []
  const existingKeys = new Set(existingProps.map((p: any) => p.key))

  for (const [key, value] of Object.entries(profile)) {
    if (!STANDARD_PROFILE_FIELDS.has(key) && !existingKeys.has(key) && typeof value === "string") {
      existingProps.push({ key, value })
    }
  }

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

function normalizeSearchResult(data: any): { profiles: TapestryProfileResponse[] } {
  const profiles = (data.profiles || []).map(normalizeProfileResponse)
  return { profiles }
}

// --- Direct Tapestry API fetcher (server-side, no proxy) ---

async function tapestryFetch(path: string, options?: RequestInit) {
  if (!TAPESTRY_API_KEY) {
    throw new Error("Tapestry API key not configured")
  }

  const separator = path.includes("?") ? "&" : "?"
  // NOTE: Tapestry API requires apiKey as query parameter (their API design).
  // This means the key appears in server logs. Ensure log sanitization in production.
  const url = `${TAPESTRY_API_URL}${path}${separator}apiKey=${TAPESTRY_API_KEY}`

  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: { "Content-Type": "application/json" },
    ...(options?.body ? { body: options.body } : {}),
  })

  if (!res.ok) {
    throw new Error(`Tapestry API error ${res.status}`)
  }

  return res.json()
}

// --- Profiles ---

export async function findOrCreateProfile(
  walletAddress: string,
  username?: string,
): Promise<TapestryProfileResponse> {
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
  properties: { key: string; value: string }[],
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
  offset = 0,
): Promise<{ profiles: TapestryProfileResponse[] }> {
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
    const fetches: Promise<{ profiles: TapestryProfileResponse[] }>[] = []
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

export function getCustomProperty(
  profile: TapestryProfile,
  key: string,
): string | undefined {
  return profile.properties?.find((p) => p.key === key)?.value
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
  endId: string,
): Promise<{ isFollowing: boolean }> {
  return tapestryFetch(`/followers/state?startId=${startId}&endId=${endId}`)
}

export async function getFollowers(
  profileId: string,
  limit = 20,
  page = 1,
): Promise<{ profiles: TapestryProfileResponse[]; page: number; pageSize: number }> {
  const data = await tapestryFetch(`/profiles/${profileId}/followers?page=${page}&pageSize=${limit}`)
  return {
    ...data,
    profiles: (data.profiles || []).map(normalizeProfileResponse),
  }
}

export async function getFollowing(
  profileId: string,
  limit = 20,
  page = 1,
): Promise<{ profiles: TapestryProfileResponse[]; page: number; pageSize: number }> {
  const data = await tapestryFetch(`/profiles/${profileId}/following?page=${page}&pageSize=${limit}`)
  return {
    ...data,
    profiles: (data.profiles || []).map(normalizeProfileResponse),
  }
}

// --- Content / Activity Feed ---

export interface TapestryContent {
  id: string
  profileId?: string
  created_at?: number
  [key: string]: any
}

export interface TapestryContentResponse {
  authorProfile?: any
  content: TapestryContent
  socialCounts?: any
}

export async function createContent(
  profileId: string,
  contentId: string,
  properties?: { key: string; value: string }[],
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

export async function updateContent(
  contentId: string,
  properties: { key: string; value: string }[],
): Promise<TapestryContentResponse> {
  return tapestryFetch(`/contents/${contentId}`, {
    method: "PUT",
    body: JSON.stringify({ properties }),
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
  } = {},
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

// --- Friend Requests ---

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

export interface FriendRequestIds {
  sentContentId: string
  receivedContentId: string
}

export async function sendFriendRequest(
  senderProfileId: string,
  targetProfileId: string,
  senderWallet: string,
  targetWallet: string,
): Promise<FriendRequestIds> {
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

  await createContent(senderProfileId, sentId, [
    { key: "eventType", value: "friend_request_sent" },
    { key: "pairContentId", value: recvId },
    ...baseProps,
  ])
  await createContent(targetProfileId, recvId, [
    { key: "eventType", value: "friend_request_received" },
    { key: "pairContentId", value: sentId },
    ...baseProps,
  ])
  return { sentContentId: sentId, receivedContentId: recvId }
}

export async function acceptFriendRequest(
  contentId: string,
  pairContentId: string,
  myProfileId: string,
  senderProfileId: string,
): Promise<boolean> {
  try {
    await Promise.all([
      updateContent(contentId, [{ key: "status", value: "accepted" }]),
      pairContentId
        ? updateContent(pairContentId, [{ key: "status", value: "accepted" }])
        : Promise.resolve(),
    ])
    await Promise.all([
      followUser(myProfileId, senderProfileId),
      followUser(senderProfileId, myProfileId),
    ])
    return true
  } catch {
    return false
  }
}

export async function rejectFriendRequest(
  contentId: string,
  pairContentId?: string,
): Promise<boolean> {
  try {
    await Promise.all([
      updateContent(contentId, [{ key: "status", value: "rejected" }]),
      pairContentId
        ? updateContent(pairContentId, [{ key: "status", value: "rejected" }])
        : Promise.resolve(),
    ])
    return true
  } catch {
    return false
  }
}

export async function getReceivedFriendRequests(
  profileId: string,
  status?: "pending" | "accepted" | "rejected",
): Promise<FriendRequest[]> {
  try {
    const result = await getContents({ profileId, pageSize: 100 })
    let items = (result.contents || [])
      .map(parseContentToFriendRequest)
      .filter((r): r is FriendRequest => r !== null && r.targetProfileId === profileId)
    if (status) items = items.filter((r) => r.status === status)
    return items
  } catch {
    return []
  }
}

// --- Activity Feed ---

export interface ActivityFeedItem {
  contentId: string
  profileId: string
  message: string
  eventType: string
  debtToken?: string
  collateralToken?: string
  amount?: string
  apy?: string
  txSignature?: string
  createdAt: string
}

export interface PostActivityResult {
  contentId: string
  response: TapestryContentResponse | null
}

export async function postLoanActivity(
  profileId: string,
  event: "created" | "accepted" | "repaid" | "foreclosed",
  details: {
    loanType?: string
    debtToken?: string
    collateralToken?: string
    amount?: number
    apy?: number
    duration?: number
    txSignature?: string
  },
): Promise<PostActivityResult | null> {
  if (!profileId) return null

  const contentId = `loan_${event}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const loanLabel = details.loanType || "loan offer"
  const amountStr = details.amount != null && details.amount > 0
    ? `${Number(details.amount.toFixed(4))} ${details.debtToken || ""}`
    : details.debtToken || "loan"
  const messages: Record<string, string> = {
    created: `Created a ${loanLabel}: ${amountStr} at ${details.apy}% APY`,
    accepted: `Accepted a ${loanLabel}: ${amountStr} at ${details.apy}% APY`,
    repaid: `Repaid a loan: ${amountStr}`,
    foreclosed: `Foreclosed a loan: ${amountStr}`,
  }

  const properties = [
    { key: "eventType", value: `loan_${event}` },
    { key: "message", value: messages[event] },
    ...(details.debtToken ? [{ key: "debtToken", value: details.debtToken }] : []),
    ...(details.collateralToken ? [{ key: "collateralToken", value: details.collateralToken }] : []),
    ...(details.amount != null ? [{ key: "amount", value: String(details.amount) }] : []),
    ...(details.apy != null ? [{ key: "apy", value: String(details.apy) }] : []),
    ...(details.duration ? [{ key: "duration", value: String(details.duration) }] : []),
    ...(details.txSignature ? [{ key: "txSignature", value: details.txSignature }] : []),
  ]

  try {
    const response = await createContent(profileId, contentId, properties)
    return { contentId, response }
  } catch {
    return null
  }
}

export async function getActivityFeed(
  profileIds: string[],
  pageSize = 20,
): Promise<ActivityFeedItem[]> {
  if (profileIds.length === 0) return []
  try {
    const results = await Promise.allSettled(
      profileIds.slice(0, 20).map((pid) =>
        getContents({ profileId: pid, pageSize: 10 }),
      ),
    )
    const items: ActivityFeedItem[] = []
    for (const result of results) {
      if (result.status !== "fulfilled") continue
      for (const c of result.value.contents || []) {
        const ct = c.content
        if (!ct.eventType || !String(ct.eventType).startsWith("loan_")) continue
        items.push({
          contentId: ct.id,
          profileId: ct.profileId || c.authorProfile?.id || "",
          message: ct.message || "",
          eventType: ct.eventType,
          debtToken: ct.debtToken,
          collateralToken: ct.collateralToken,
          amount: ct.amount ? String(ct.amount) : undefined,
          apy: ct.apy ? String(ct.apy) : undefined,
          txSignature: ct.txSignature,
          createdAt: ct.created_at ? new Date(ct.created_at).toISOString() : "",
        })
      }
    }
    const seen = new Set<string>()
    return items
      .filter((i) => { if (seen.has(i.contentId)) return false; seen.add(i.contentId); return true })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, pageSize)
  } catch {
    return []
  }
}

// --- Favourites (built on Likes API) ---
// Each target profile gets a content node "profile_fav_{targetProfileId}".
// Liking that content node = favouriting the profile.
// POST /likes/{contentId} with {"startId": myProfileId}
// GET /likes/{contentId} returns {profiles: [...], total: N}

const FAV_PREFIX = "profile_fav_"

/** Ensure the content node for a target profile exists */
async function ensureFavContentNode(profileId: string, targetProfileId: string) {
  const contentId = `${FAV_PREFIX}${targetProfileId}`
  await createContent(profileId, contentId, [
    { key: "eventType", value: "profile_fav_target" },
    { key: "targetProfileId", value: targetProfileId },
  ])
}

export async function favoriteProfile(myProfileId: string, targetProfileId: string): Promise<void> {
  await ensureFavContentNode(myProfileId, targetProfileId)
  const contentId = `${FAV_PREFIX}${targetProfileId}`
  await tapestryFetch(`/likes/${contentId}`, {
    method: "POST",
    body: JSON.stringify({ startId: myProfileId }),
  })
}

export async function unfavoriteProfile(myProfileId: string, targetProfileId: string): Promise<void> {
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
