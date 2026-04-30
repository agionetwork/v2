"use client"

import { motion, useInView } from "framer-motion"
import { useRef, useEffect, useState } from "react"

const TAPESTRY_NAMESPACE = "agio"

function AnimatedNumber({ value, suffix, prefix, duration = 2 }: { value: number; suffix: string; prefix: string; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView || value === 0) return

    const start = 0
    const end = value
    const startTime = performance.now()
    const ms = duration * 1000

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / ms, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(eased * (end - start) + start)
      setCount(current)
      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }

    requestAnimationFrame(step)
  }, [isInView, value, duration])

  const formatted = count >= 1000 ? `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}K` : count.toString()

  return (
    <span ref={ref}>
      {prefix}{formatted}{suffix}
    </span>
  )
}

const FALLBACK_FOLLOWERS = 900

export function StatsSection() {
  const [profileCount, setProfileCount] = useState(0)
  const [followersCount, setFollowersCount] = useState(FALLBACK_FOLLOWERS)

  useEffect(() => {
    // Fetch Tapestry profile count
    fetch("/api/tapestry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `/profiles/?namespace=${TAPESTRY_NAMESPACE}&page=1&pageSize=1`,
        method: "GET",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const total = data.totalCount ?? data.profiles?.length ?? 0
        if (total > 0) setProfileCount(total)
      })
      .catch(() => {})

    // Fetch X followers count (falls back to hardcoded if API unavailable)
    fetch("/api/twitter/followers")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.followers === "number" && data.followers > 0) {
          setFollowersCount(data.followers)
        }
      })
      .catch(() => {})
  }, [])

  const stats = [
    {
      value: 5000,
      suffix: "+",
      prefix: "",
      label: "Wallets on Waitlist",
    },
    {
      value: followersCount,
      suffix: "+",
      prefix: "",
      label: "Followers on X",
    },
    {
      value: profileCount,
      suffix: profileCount > 0 ? "" : "",
      prefix: "",
      label: "Early Adopters",
    }
  ]

  return (
    <section className="w-full py-20 md:py-32">
      <div className="container px-4 md:px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-4 text-black dark:text-white">
            Platform Statistics
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Metrics showing our platform&apos;s growth and performance
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-gray-200/10 p-8 rounded-lg shadow-lg text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="text-center">
                <h3 className="text-5xl md:text-6xl font-bold mb-3 text-black dark:text-white">
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                </h3>
                <p className="text-lg font-semibold text-black dark:text-white">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
