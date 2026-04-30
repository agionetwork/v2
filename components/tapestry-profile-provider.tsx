"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { useWalletContext } from "@/components/wallet-provider"
import {
  findOrCreateProfile,
  getProfile,
  updateProfile,
  checkTapestryConfigured,
  postLoanActivity,
  searchProfilesCrossApp,
  getCustomProperty,
  type TapestryProfileResponse,
} from "@/lib/tapestry"

type LoanActivityEvent = "created" | "accepted" | "repaid" | "foreclosed"
type LoanActivityDetails = {
  loanType?: string
  debtToken?: string
  collateralToken?: string
  amount?: number
  collateralAmount?: number
  apy?: number
  duration?: number
  txSignature?: string
}

interface TapestryContextType {
  profile: TapestryProfileResponse | null
  isLoading: boolean
  error: string | null
  refreshProfile: () => Promise<void>
  updateMyProfile: (properties: { key: string; value: string }[]) => Promise<void>
  postActivity: (event: LoanActivityEvent, details: LoanActivityDetails) => Promise<void>
}

const TapestryContext = createContext<TapestryContextType>({
  profile: null,
  isLoading: false,
  error: null,
  refreshProfile: async () => {},
  updateMyProfile: async () => {},
  postActivity: async () => {},
})

// --- localStorage helpers keyed by wallet address ---
const STORAGE_PREFIX = "agio_profile_"

function saveProfileLocal(address: string, props: { key: string; value: string }[]) {
  try {
    const existing = loadProfileLocal(address)
    for (const p of props) {
      existing[p.key] = p.value
    }
    localStorage.setItem(`${STORAGE_PREFIX}${address}`, JSON.stringify(existing))
  } catch { /* localStorage unavailable */ }
}

function loadProfileLocal(address: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${address}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function buildLocalProfile(address: string): TapestryProfileResponse {
  const stored = loadProfileLocal(address)
  const properties = Object.entries(stored).map(([key, value]) => ({ key, value }))
  return {
    profile: {
      id: `local_${address}`,
      username: stored.displayName || address.slice(0, 8),
      walletAddress: address,
      blockchain: "SOLANA",
      properties,
      created_at: Date.now(),
    },
    socialCounts: { followers: 0, following: 0 },
  }
}

export function TapestryProfileProvider({ children }: { children: ReactNode }) {
  const { isConnected, address } = useWalletContext()
  const [profile, setProfile] = useState<TapestryProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initProfile = useCallback(async () => {
    if (!address) return

    setIsLoading(true)
    setError(null)

    try {
      const configured = await checkTapestryConfigured()
      if (!configured) {
        setProfile(buildLocalProfile(address))
        setIsLoading(false)
        return
      }

      const result = await findOrCreateProfile(address)
      if (result?.profile) {
        // Merge localStorage data into Tapestry profile for any missing properties
        const localData = loadProfileLocal(address)
        const existing = new Set(result.profile.properties?.map(p => p.key) || [])
        for (const [key, value] of Object.entries(localData)) {
          if (!existing.has(key) && value) {
            result.profile.properties = result.profile.properties || []
            result.profile.properties.push({ key, value })
          }
        }
        // Cross-app profile discovery: if profile is new (no displayName),
        // try to import data from other Tapestry apps
        const hasDisplayName = result.profile.properties?.some(
          (p) => p.key === "displayName" && p.value
        )
        if (!hasDisplayName) {
          try {
            const crossAppProfiles = await searchProfilesCrossApp(address)
            if (crossAppProfiles.length > 0) {
              const donor = crossAppProfiles.find((p) => {
                const name = getCustomProperty(p.profile, "displayName")
                return !!name
              })
              if (donor) {
                const importProps: { key: string; value: string }[] = []
                const donorName = getCustomProperty(donor.profile, "displayName")
                const donorBio = getCustomProperty(donor.profile, "bio")
                const donorImage =
                  getCustomProperty(donor.profile, "profileImage") || donor.profile.image
                if (donorName) importProps.push({ key: "displayName", value: donorName })
                if (donorBio) importProps.push({ key: "bio", value: donorBio })
                if (donorImage) importProps.push({ key: "profileImage", value: donorImage })
                if (importProps.length > 0) {
                  await updateProfile(result.profile.id, importProps)
                  const refreshed = await getProfile(result.profile.id)
                  if (refreshed) {
                    setProfile(refreshed)
                    setIsLoading(false)
                    return
                  }
                }
              }
            }
          } catch {
            // Cross-app import failed silently — continue with existing profile
          }
        }

        setProfile(result)
      } else {
        // Tapestry unavailable — use local profile
        setProfile(buildLocalProfile(address))
      }
    } catch (err: any) {
      console.error("Failed to init Tapestry profile:", err)
      // Fall back to local profile so the app still works
      setProfile(buildLocalProfile(address))
      setError(null) // clear error since we have a fallback
    } finally {
      setIsLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (isConnected && address) {
      initProfile()
    } else {
      setProfile(null)
      setError(null)
    }
  }, [isConnected, address, initProfile])

  const refreshProfile = useCallback(async () => {
    if (!profile?.profile?.id) return
    // If local-only profile, just rebuild from localStorage
    if (profile.profile.id.startsWith("local_") && address) {
      setProfile(buildLocalProfile(address))
      return
    }
    try {
      const result = await getProfile(profile.profile.id)
      setProfile(result)
    } catch (err: any) {
      console.error("Failed to refresh profile:", err)
    }
  }, [profile?.profile?.id, address])

  const updateMyProfile = useCallback(
    async (properties: { key: string; value: string }[]) => {
      // Always persist to localStorage
      if (address) {
        saveProfileLocal(address, properties)
      }

      if (profile?.profile?.id && !profile.profile.id.startsWith("local_")) {
        // Tapestry profile exists — update remotely
        try {
          await updateProfile(profile.profile.id, properties)
          // Re-fetch to get the full normalized profile from Tapestry
          const refreshed = await getProfile(profile.profile.id)
          setProfile(refreshed)
          return
        } catch (err: any) {
          console.error("Failed to update Tapestry profile:", err)
          // Fall through to local update
        }
      }

      // Update local profile state
      if (address) {
        setProfile(buildLocalProfile(address))
      }
    },
    [profile?.profile?.id, address]
  )

  const postActivity = useCallback(
    async (event: LoanActivityEvent, details: LoanActivityDetails) => {
      const profileId = profile?.profile?.id
      if (!profileId) return
      await postLoanActivity(profileId, event, details)
    },
    [profile?.profile?.id]
  )

  return (
    <TapestryContext.Provider
      value={{ profile, isLoading, error, refreshProfile, updateMyProfile, postActivity }}
    >
      {children}
    </TapestryContext.Provider>
  )
}

export const useTapestryProfile = () => useContext(TapestryContext)
