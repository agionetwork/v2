"use client"

import dynamic from "next/dynamic"

const BankIcon = dynamic(() => import("@/components/landing/pillar-icons").then(m => ({ default: m.BankIcon })), { ssr: false })
const GlobeIcon = dynamic(() => import("@/components/landing/pillar-icons").then(m => ({ default: m.GlobeIcon })), { ssr: false })
const AgentIcon = dynamic(() => import("@/components/landing/pillar-icons").then(m => ({ default: m.AgentIcon })), { ssr: false })
const BotIcon = dynamic(() => import("@/components/landing/pillar-icons").then(m => ({ default: m.BotIcon })), { ssr: false })

const PILLARS = [
  {
    icon: <BankIcon />,
    title: "Better than a bank",
    desc: "Banks charge both sides. On Agio, the spread stays between lender and borrower, no middleman cut. Just a 1% origination fee.",
  },
  {
    icon: <GlobeIcon />,
    title: "Cross-border by design",
    desc: "Lend to a cousin overseas or a supplier in another country. Solana settles in sub-seconds. Currencies and borders abstracted away.",
  },
  {
    icon: <AgentIcon />,
    title: "AI agents as participants",
    desc: "Autonomous agents can lend, borrow, and manage loans through the MCP server. 14 tools available for seamless human-agent collaboration.",
  },
  {
    icon: <BotIcon />,
    title: "Automated lending bot",
    desc: "Activate a bot that lends, borrows, and manages positions 24/7 following your strategy. Privy-managed wallet, cron execution, full action history.",
  },
]

export function PillarsSection() {
  return (
    <section id="why-agio" className="py-[120px] border-b border-[#1C2A52] relative bg-[#0A1230]">
      <div className="max-w-[1360px] mx-auto px-4 md:px-10">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 md:gap-12 mb-16">
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#8FA8D8] pt-3">02 / WHY AGIO</div>
          <h2 className="font-display font-medium text-[clamp(32px,3.6vw,52px)] leading-[1.05] tracking-[-0.022em] text-white" style={{ textWrap: "balance" } as React.CSSProperties}>
            Lending secured by <em className="not-italic text-[#4A90FF] font-normal">smart-contracts</em>,<br />not by institutions.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#1C2A52] border border-[#1C2A52]">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-[#0A1230] hover:bg-[#0E1A42] transition-colors p-9 flex flex-col items-center text-center">
              <div className="flex items-center justify-center">
                {p.icon}
              </div>
              <h4 className="font-display text-xl font-medium mt-5 mb-2.5 tracking-[-0.01em] text-white">{p.title}</h4>
              <p className="text-[#8FA8D8] text-sm max-w-[320px]">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
