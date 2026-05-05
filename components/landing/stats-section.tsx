"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"

function SlotNumber({ value, duration = 1500 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState("0")
  const [rolling, setRolling] = useState(true)
  const frameRef = useRef(0)
  const startRef = useRef(0)

  useEffect(() => {
    // Extract numeric part and suffix (e.g., "5K+" → num=5000, suffix="K+", display target="5K+")
    const match = value.match(/^([\d,]+)(.*)$/)
    if (!match) {
      setDisplay(value)
      setRolling(false)
      return
    }

    const numStr = match[1].replace(/,/g, "")
    const target = parseInt(numStr, 10)
    const suffix = match[2] || ""

    if (isNaN(target)) {
      setDisplay(value)
      setRolling(false)
      return
    }

    startRef.current = performance.now()
    setRolling(true)

    function tick() {
      const elapsed = performance.now() - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)

      if (progress < 1) {
        // During roll, show random-ish numbers that converge to target
        const current = Math.round(eased * target)
        // Format with the same pattern as final value
        if (value.includes("K")) {
          const k = current >= 1000 ? Math.round(current / 1000) : current
          setDisplay(`${k}K${suffix.replace("K", "")}`)
        } else {
          setDisplay(`${current}${suffix}`)
        }
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(value)
        setRolling(false)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return (
    <span className={rolling ? "inline-block" : ""}>
      {display}
    </span>
  )
}

export function StatsSection() {
  const [profileCount, setProfileCount] = useState(34)
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Use the same source the leaderboard reads: distinct wallets that have
    // claimed a Tapestry profile in the Agio namespace. Counting profile
    // totalCount produces a higher number when a wallet has multiple
    // profiles, which made the landing stat (37) disagree with the
    // leaderboard count (30). One source of truth.
    fetch("/api/tapestry/profiles/all")
      .then((res) => res.json())
      .then((data) => {
        const count = typeof data?.count === "number"
          ? data.count
          : Array.isArray(data?.wallets) ? data.wallets.length : 0
        if (count > 0) setProfileCount(count)
      })
      .catch(() => {})
  }, [])

  // Trigger slot animation when section scrolls into view
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const stats = [
    {
      label: "Wallets on Waitlist",
      value: "5K+",
      meta: "and growing",
      href: undefined as string | undefined,
    },
    {
      label: "Followers on X",
      value: "800+",
      meta: "@agio_network",
      href: "https://x.com/agio_network",
    },
    {
      label: "Early Adopters",
      value: profileCount > 0 ? String(profileCount) : "...",
      meta: "onboarded to devnet",
      href: undefined as string | undefined,
    },
  ]

  return (
    <section ref={sectionRef} id="statistics" className="py-[120px] border-b border-[#1C2A52] relative bg-[#0A1230]">
      <div className="max-w-[1360px] mx-auto px-4 md:px-10">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 md:gap-12 mb-16">
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#8FA8D8] pt-3">03 / PLATFORM STATISTICS</div>
          <h2 className="font-display font-medium text-[clamp(32px,3.6vw,52px)] leading-[1.05] tracking-[-0.022em] text-white" style={{ textWrap: "balance" } as React.CSSProperties}>
            Growth and <em className="not-italic text-[#4A90FF] font-normal">performance</em>.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#1C2A52] border border-[#1C2A52]">
          {stats.map((s, i) => (
            <div key={s.label} className="bg-[#0A1230] py-14 md:py-24 px-6 md:px-10 text-center">
              <div className="font-mono text-xs tracking-[0.14em] uppercase text-[#8FA8D8]">{s.label}</div>
              <div className="font-display text-[clamp(44px,5.2vw,68px)] font-medium tracking-[-0.025em] text-white mt-4">
                {visible ? <SlotNumber value={s.value} duration={1200 + i * 400} /> : "0"}
              </div>
              <div className="font-mono text-[13px] text-[#8FA8D8] mt-3">
                {s.href ? (
                  <Link href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-[#4A90FF] transition-colors">
                    {s.meta}
                  </Link>
                ) : (
                  s.meta
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
