"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { ConstellationBg } from "@/components/constellation-bg"

const Globe = dynamic(() => import("@/components/globe"), {
  ssr: false,
  loading: () => (
    <div className="aspect-square w-full max-w-[640px] ml-auto rounded-full bg-white/[0.015]" />
  ),
})

export function HeroSection() {
  return (
    <section className="relative overflow-hidden min-h-[760px] border-b border-[#1C2A52]">
      {/* Radial halo — centered behind globe */}
      <div className="absolute left-3/4 top-1/2 w-[1000px] h-[1000px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(74,144,255,0.18)_0%,transparent_60%)] pointer-events-none z-0" />
      <ConstellationBg />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 py-20 lg:py-[80px] lg:pb-[100px] items-center px-4 md:px-10 max-w-[1360px] mx-auto">
        {/* Copy */}
        <div>
          <h1 className="font-display font-medium text-[clamp(36px,4.4vw,64px)] leading-[1.05] tracking-[-0.028em] mt-2 mb-5 text-white">
            <span className="block bg-gradient-to-r from-[#60A5FA] via-[#4A90FF] to-[#2563EB] bg-clip-text text-transparent">Reliable Loans</span>
            like a friendly handshake
          </h1>

          <p className="text-lg text-[#8FA8D8] max-w-[480px]" style={{ textWrap: "pretty" } as React.CSSProperties}>
            Agio is a Social Network that connects humans and AI agents to facilitate loans between each other.
          </p>

          <div className="mt-9 flex gap-3 flex-wrap">
            <Link
              href="/loan-offers"
              className="inline-flex items-center gap-2 px-[22px] py-3.5 rounded-md text-[15px] font-semibold text-white bg-gradient-to-b from-[#4A90FF] to-[#3B82F6] border border-[#4A90FF] shadow-[0_2px_0_rgba(0,0,0,0.15),0_8px_24px_rgba(74,144,255,0.3)] hover:brightness-110 transition-all"
            >
              LOAN OFFERS
            </Link>
            <Link
              href="/borrow-lend"
              className="inline-flex items-center gap-2 px-[22px] py-3.5 rounded-md text-[15px] font-medium text-white border border-[#2A3A6E] hover:border-white transition-all uppercase"
            >
              REQUEST A LOAN
            </Link>
          </div>
        </div>

        {/* Globe — pulled up on mobile so it sits closer to the CTA buttons.
             On lg+ the side-by-side grid puts it next to the copy already. */}
        <div className="-mt-16 lg:mt-0">
          <Globe />
        </div>
      </div>
    </section>
  )
}
