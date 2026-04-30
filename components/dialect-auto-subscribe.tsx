"use client"

import { useEffect, useRef, useState } from "react"
import { useDialectSdk, useUnreadSummary, useSubscribe } from "@dialectlabs/react-sdk"

/**
 * Inner component that uses subscribe/summary hooks.
 * Only mounted once the SDK is confirmed ready.
 */
function AutoSubscribeInner() {
  const { summary } = useUnreadSummary({ revalidateOnMount: true })
  const { subscribe } = useSubscribe({ channel: "IN_APP" })
  const attempted = useRef(false)

  useEffect(() => {
    if (!summary || attempted.current) return
    if (summary.subscribed) return
    attempted.current = true
    subscribe().catch(() => {})
  }, [summary, subscribe])

  return null
}

/**
 * Invisible component that auto-subscribes the connected wallet to IN_APP
 * notifications. Must be rendered inside the DialectSolanaSdk provider tree.
 * Waits for the SDK to be fully initialized before activating hooks.
 */
export function DialectAutoSubscribe() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Small delay to let the SDK finish initializing after mount
    const t = setTimeout(() => setReady(true), 1500)
    return () => clearTimeout(t)
  }, [])

  if (!ready) return null

  return <SafeAutoSubscribe />
}

/**
 * Wrapper that catches the "sdk not initialized" error
 * and silently skips until the SDK is ready.
 */
function SafeAutoSubscribe() {
  try {
    // useDialectSdk throws if SDK is not initialized
    useDialectSdk()
  } catch {
    return null
  }
  return <AutoSubscribeInner />
}
