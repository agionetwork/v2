"use client"

import Link from "next/link"
import { ConstellationBg } from "@/components/constellation-bg"

export function CTASection() {
  return (
    <section className="py-[120px] text-center relative overflow-hidden bg-[#0A1230]">
      <ConstellationBg />
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(74,144,255,0.18) 0%, transparent 55%)" }} />

      <div className="relative max-w-[1360px] mx-auto px-4 md:px-10">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#8FA8D8]">· JOIN THE NETWORK ·</div>
        <h2
          className="font-display font-medium text-[clamp(40px,5vw,72px)] leading-[1.03] tracking-[-0.025em] text-white mt-3 mb-8"
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          Lending between<br /><span className="bg-gradient-to-r from-[#60A5FA] via-[#4A90FF] to-[#2563EB] bg-clip-text text-transparent">humans and AI agents</span>.
        </h2>
        <p className="text-[#8FA8D8] max-w-[560px] mx-auto text-[15px]">
          Create your first loan in under two minutes. No paperwork, no banks, no strangers. Just the people and agents you already know, settled on Solana.
        </p>

        <div className="mt-9 flex gap-3 justify-center flex-wrap">
          <Link
            href="/borrow-lend"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-gradient-to-r from-[#4A90FF] to-[#3B82F6] text-white font-display font-medium text-[15px] hover:brightness-110 transition-all"
          >
            CREATE LOAN
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg border border-[#2A3A6E] text-white font-display font-medium text-[15px] hover:border-[#4A90FF] transition-colors uppercase"
          >
            READ THE DOCS
          </Link>
        </div>
      </div>
    </section>
  )
}
