"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CircleDollarSign, Users, UserPlus, Sparkles, Loader2, ArrowRight, Clock, Wallet, Search } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletContext } from "@/components/wallet-provider"
import { useFriends } from "@/components/friends-provider"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import {
  searchProfiles,
  getCustomProperty,
  type TapestryProfileResponse,
} from "@/lib/tapestry"
import { toast } from "sonner"

import { ProfileCard } from "@/components/socialfi/profile-card"
import { ActivityFeed } from "@/components/socialfi/activity-feed"
import { FriendsList } from "@/components/socialfi/friends-list"
import { FriendRequests } from "@/components/socialfi/friend-requests"
import { FriendSuggestions } from "@/components/socialfi/friend-suggestions"
import { CommunityProfiles } from "@/components/socialfi/community-profiles"
import { FavouriteProfiles } from "@/components/socialfi/favourite-profiles"

type NavItem = "feed" | "network"

const NAV_ITEMS: { key: NavItem; label: string; icon: typeof CircleDollarSign }[] = [
  { key: "feed", label: "Offers", icon: CircleDollarSign },
  { key: "network", label: "Network", icon: Users },
]

function SidebarProfileCard({ profile }: { profile: TapestryProfileResponse }) {
  const { sendRequest, acceptRequest, getFriendshipStatus, receivedRequests } = useFriends()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const p = profile.profile
  const displayName = getCustomProperty(p, "displayName") || p.username
  const pfp = getCustomProperty(p, "profileImage") || p.image
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
      toast.success(`Request sent to ${displayName}`)
      setSent(true)
    } else {
      toast.error("Failed to send request")
    }
    setSending(false)
  }

  const isPending = status === "pending_sent" || sent
  const isFriend = status === "friend" || accepted

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <Link href={`/socialfi/profile/${p.walletAddress}`}>
        <Avatar className="h-9 w-9 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all">
          {pfp ? <AvatarImage src={pfp} alt={displayName} /> : null}
          <AvatarFallback className="bg-blue-600 text-white text-xs">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/socialfi/profile/${p.walletAddress}`} className="hover:text-blue-600 transition-colors">
          <p className="text-sm font-medium truncate">{displayName}</p>
        </Link>
        {isFriend && (
          <p className="text-xs text-muted-foreground">Connected</p>
        )}
      </div>
      {isPending ? (
        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      ) : !isFriend ? (
        <Button
          size="sm"
          variant="default"
          className="h-7 px-2 text-xs bg-[#1358EC] hover:bg-blue-700 text-white"
          onClick={handleAdd}
          disabled={sending}
        >
          {sending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <UserPlus className="h-3.5 w-3.5" />
          )}
        </Button>
      ) : null}
    </div>
  )
}

export default function SocialFiPageClient() {
  const { isConnected } = useWalletContext()
  const [activeNav, setActiveNav] = useState<NavItem>("feed")
  const [networkFilter, setNetworkFilter] = useState<"my-network" | "all-profiles" | "favourites" | "suggestions" | "requests">("my-network")
  const [networkSearchInput, setNetworkSearchInput] = useState("")
  const [networkSearch, setNetworkSearch] = useState("")
  const { friends, pendingReceivedCount, refreshSuggestions } = useFriends()
  const { profile: myProfile } = useTapestryProfile()
  const myProfileId = myProfile?.profile?.id || null

  // Sidebar suggestions: fetch community profiles and filter out self + friends
  const [sidebarProfiles, setSidebarProfiles] = useState<TapestryProfileResponse[]>([])
  const [loadingSidebar, setLoadingSidebar] = useState(true)

  const friendIdSet = useMemo(() => new Set(friends.map((f) => f.profile.id)), [friends])

  const loadSidebarProfiles = useCallback(async () => {
    setLoadingSidebar(true)
    try {
      const result = await searchProfiles(undefined, 20, 0)
      setSidebarProfiles(result.profiles || [])
    } catch {
      // keep existing
    } finally {
      setLoadingSidebar(false)
    }
  }, [])

  useEffect(() => {
    if (isConnected) loadSidebarProfiles()
  }, [loadSidebarProfiles, isConnected])

  // Filter: exclude self and existing friends, take first 3
  const sidebarSuggestions = useMemo(() => {
    return sidebarProfiles
      .filter((p) => p.profile.id !== myProfileId && !friendIdSet.has(p.profile.id))
      .slice(0, 3)
  }, [sidebarProfiles, myProfileId, friendIdSet])

  const handleNavChange = (key: NavItem) => {
    setActiveNav(key)
  }

  if (!isConnected) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-xl font-semibold mb-2">Connect your wallet</p>
            <p className="text-sm">Connect your wallet to access SocialFi features.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      <ProfileCard />

      {/* Mobile Navigation - only visible on small screens */}
      <div className="flex justify-center gap-2 mb-4 md:hidden overflow-x-auto pb-2">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = activeNav === key
          return (
            <button
              key={key}
              onClick={() => handleNavChange(key)}
              className={`agio-glass-nav-item flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive ? "agio-glass-nav-item--active text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === "network" && pendingReceivedCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {pendingReceivedCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 3-Column Layout */}
      <div className="flex gap-6">
        {/* Left Sidebar - Vertical Navigation */}
        <nav className="w-48 flex-shrink-0 hidden md:block">
          <div className="sticky top-24 space-y-1">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
              const isActive = activeNav === key
              const count = key === "network" && pendingReceivedCount > 0
                ? pendingReceivedCount
                : null

              return (
                <button
                  key={key}
                  onClick={() => handleNavChange(key)}
                  className={`agio-glass-nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive ? "agio-glass-nav-item--active text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {count !== null && (
                    <span
                      className={`inline-flex items-center justify-center h-5 min-w-[20px] rounded-full text-xs font-bold px-1.5 ${
                        isActive ? "bg-white/20 text-white" : "bg-red-500 text-white"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Center - Main Content */}
        <main className="flex-1 min-w-0">
          {activeNav === "feed" && <ActivityFeed />}
          {activeNav === "network" && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Select value={networkFilter} onValueChange={(v: typeof networkFilter) => {
                  setNetworkFilter(v)
                  if (v === "suggestions") refreshSuggestions()
                  if (v === "suggestions" || v === "requests" || v === "favourites") {
                    setNetworkSearchInput("")
                    setNetworkSearch("")
                  }
                }}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-profiles">All Profiles</SelectItem>
                    <SelectItem value="suggestions">Suggestions</SelectItem>
                    <SelectItem value="my-network">My Network</SelectItem>
                    <SelectItem value="favourites">Favourites</SelectItem>
                    <SelectItem value="requests">
                      <span className="flex items-center gap-2">
                        Requests
                        {pendingReceivedCount > 0 && (
                          <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                            {pendingReceivedCount}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {(networkFilter === "my-network" || networkFilter === "all-profiles") && (
                  <>
                    <div className="relative flex-1">
                      <Input
                        placeholder="Search by name or wallet..."
                        value={networkSearchInput}
                        onChange={(e) => {
                          setNetworkSearchInput(e.target.value)
                          if (!e.target.value.trim()) setNetworkSearch("")
                        }}
                        onKeyDown={(e) => e.key === "Enter" && setNetworkSearch(networkSearchInput.trim())}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="flex-shrink-0"
                      onClick={() => setNetworkSearch(networkSearchInput.trim())}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {networkFilter === "my-network" && <FriendsList searchQuery={networkSearch} />}
              {networkFilter === "all-profiles" && <CommunityProfiles searchQuery={networkSearch} />}
              {networkFilter === "favourites" && <FavouriteProfiles />}
              {networkFilter === "suggestions" && <FriendSuggestions showEmpty />}
              {networkFilter === "requests" && <FriendRequests />}
            </>
          )}
        </main>

        {/* Right Sidebar - Network Suggestions & Stats */}
        <aside className="w-64 flex-shrink-0 hidden md:block">
          <div className="sticky top-24 space-y-4">
            {/* Network Suggestions */}
            <Card className="border border-gray-200 dark:border-gray-200/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-muted-foreground">Network Suggestions</h4>
                </div>
                {loadingSidebar ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                ) : sidebarSuggestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No suggestions available yet.</p>
                ) : (
                  <div className="space-y-1">
                    {sidebarSuggestions.map((p) => (
                      <SidebarProfileCard key={p.profile.id} profile={p} />
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-blue-600 hover:text-blue-700"
                  onClick={() => { setActiveNav("network"); setNetworkFilter("all-profiles") }}
                >
                  View All Profiles
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </CardContent>
            </Card>

          </div>
        </aside>
      </div>
    </div>
  )
}
