"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Save, Loader2, Camera, BadgeCheck, Bell } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Notifications } from "@dialectlabs/react-ui"
import { useDialectAvailable } from "@/components/dialect-provider"
import { useTapestryProfile } from "@/components/tapestry-profile-provider"
import { useWalletContext } from "@/components/wallet-provider"
import { getCustomProperty, checkUsernameAvailable } from "@/lib/tapestry"
import { toast } from "sonner"

function compressImage(file: File, maxSize = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = maxSize
        canvas.height = maxSize

        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("Canvas not supported"))

        // Draw centered/cropped square
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize)

        resolve(canvas.toDataURL("image/jpeg", 0.7))
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

export default function EditProfilePage() {
  const { profile: myProfile, isLoading, updateMyProfile } = useTapestryProfile()
  const { isConnected } = useWalletContext()
  const { theme } = useTheme()
  const dialectAvailable = useDialectAvailable()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState("")
  const [bio, setBio] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [twitter, setTwitter] = useState("")
  const [twitterVerified, setTwitterVerified] = useState(false)
  const [connectingTwitter, setConnectingTwitter] = useState(false)
  const [telegram, setTelegram] = useState("")

  useEffect(() => {
    if (myProfile?.profile) {
      const p = myProfile.profile
      setDisplayName(getCustomProperty(p, "displayName") || p.username || "")
      setBio(getCustomProperty(p, "bio") || "")
      setProfileImage(getCustomProperty(p, "profileImage") || "")
      setTwitter(getCustomProperty(p, "twitter") || "")
      setTwitterVerified(getCustomProperty(p, "twitterVerified") === "true")
      setTelegram(getCustomProperty(p, "telegram") || "")
    }
  }, [myProfile])

  // Handle OAuth callback redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const verifiedHandle = params.get("twitter_verified")
    const twitterError = params.get("twitter_error")

    if (verifiedHandle) {
      setTwitter(verifiedHandle)
      setTwitterVerified(true)
      toast.success(`X account @${verifiedHandle} verified!`)
      window.history.replaceState({}, "", "/socialfi/edit-profile")
    } else if (twitterError) {
      const messages: Record<string, string> = {
        access_denied: "X authorization was cancelled",
        invalid_state: "Session expired. Please try again.",
        token_exchange_failed: "Failed to verify with X. Please try again.",
        user_fetch_failed: "Could not fetch X profile. Please try again.",
        missing_params: "Invalid callback. Please try again.",
        internal_error: "Something went wrong. Please try again.",
      }
      toast.error(messages[twitterError] || "X verification failed")
      window.history.replaceState({}, "", "/socialfi/edit-profile")
    }
  }, [])

  const handleConnectTwitter = async () => {
    const walletAddress = myProfile?.profile?.walletAddress
    if (!walletAddress) {
      toast.error("Connect your wallet first")
      return
    }
    setConnectingTwitter(true)
    try {
      const res = await fetch(`/api/auth/twitter?wallet=${walletAddress}`)
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data.error || "Failed to start X verification")
        setConnectingTwitter(false)
        return
      }
      window.location.href = data.url
    } catch {
      toast.error("Failed to connect to X")
      setConnectingTwitter(false)
    }
  }

  const handleDisconnectTwitter = () => {
    setTwitter("")
    setTwitterVerified(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB")
      return
    }

    try {
      const compressed = await compressImage(file)
      setProfileImage(compressed)
      toast.success("Image uploaded")
    } catch {
      toast.error("Failed to process image")
    }
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast.error("Username is required")
      return
    }

    setSaving(true)
    try {
      // Check username uniqueness
      const walletAddress = myProfile?.profile?.walletAddress
      if (walletAddress) {
        const available = await checkUsernameAvailable(displayName, walletAddress)
        if (!available) {
          toast.error("This username is already taken. Please choose another.")
          setSaving(false)
          return
        }
      }

      await updateMyProfile([
        { key: "displayName", value: displayName.trim() },
        { key: "bio", value: bio },
        { key: "profileImage", value: profileImage },
        { key: "twitter", value: twitter },
        { key: "twitterVerified", value: twitterVerified ? "true" : "false" },
        { key: "telegram", value: telegram },
      ])
      toast.success("Profile updated successfully!")
      router.push("/socialfi")
    } catch (err) {
      toast.error("Failed to update profile")
      setSaving(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg font-medium mb-1">Connect your wallet</p>
            <p className="text-sm">You need to connect your wallet to edit your profile.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/socialfi">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">Edit Profile</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="h-24 w-24">
                {profileImage ? (
                  <AvatarImage src={profileImage} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-blue-600 text-white text-3xl">
                  {(displayName || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4 mr-2" />
              Upload Photo
            </Button>
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Username</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your username"
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              className="min-h-[80px]"
            />
          </div>

          {/* Twitter / X */}
          <div className="space-y-2">
            <Label htmlFor="twitter">X (Twitter)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="twitter"
                  value={twitter}
                  onChange={(e) => {
                    setTwitter(e.target.value)
                    if (twitterVerified) setTwitterVerified(false)
                  }}
                  placeholder="@username"
                  className={twitterVerified ? "pr-8 border-green-500/50" : ""}
                />
                {twitterVerified && (
                  <BadgeCheck className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
              </div>
              {twitterVerified ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs text-muted-foreground"
                  onClick={handleDisconnectTwitter}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={handleConnectTwitter}
                  disabled={connectingTwitter}
                >
                  {connectingTwitter ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Connect
                    </>
                  )}
                </Button>
              )}
            </div>
            {twitterVerified && (
              <p className="text-xs text-green-600">Verified via X OAuth</p>
            )}
          </div>

          {/* Telegram */}
          <div className="space-y-2">
            <Label htmlFor="telegram">Telegram</Label>
            <Input
              id="telegram"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@username"
            />
          </div>

          {/* Update Profile Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#1358EC] hover:bg-blue-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Update Profile
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Dialect Notification Preferences */}
      {dialectAvailable && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Subscribe to receive alerts via email or Telegram when your loans are accepted, repaid, or foreclosed.
            </p>
          </CardHeader>
          <CardContent>
            <div className="dialect-notifications-settings [&_.dt-notifications]:!shadow-none [&_.dt-notifications]:!border-0 [&_.dt-notifications]:!p-0 [&_.dt-notifications]:!bg-transparent">
              <Notifications
                channels={["email", "telegram"]}
                theme={theme === "dark" ? "dark" : "light"}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
