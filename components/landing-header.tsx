"use client"

import Link from "next/link"

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-transparent">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="font-bold text-xl text-white">
          AGIO NETWORK
        </Link>
      </div>
    </header>
  )
} 