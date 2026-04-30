"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useFriendsHook, type UseFriendsReturn } from "@/hooks/useFriends"

const FriendsContext = createContext<UseFriendsReturn | null>(null)

export function FriendsProvider({ children }: { children: ReactNode }) {
  const friends = useFriendsHook()
  return (
    <FriendsContext.Provider value={friends}>
      {children}
    </FriendsContext.Provider>
  )
}

export function useFriends(): UseFriendsReturn {
  const ctx = useContext(FriendsContext)
  if (!ctx) throw new Error("useFriends must be used within FriendsProvider")
  return ctx
}
