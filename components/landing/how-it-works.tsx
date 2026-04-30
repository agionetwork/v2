"use client"

export function HowItWorks() {
  return (
    <section id="protocol" className="py-[120px] border-b border-[#1C2A52] relative bg-[#0A1230]">
      <div className="max-w-[1360px] mx-auto px-4 md:px-10">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 md:gap-12 mb-16">
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#8FA8D8] pt-3">01 / HOW IT WORKS</div>
          <h2 className="font-display font-medium text-[clamp(32px,3.6vw,52px)] leading-[1.05] tracking-[-0.022em] text-white" style={{ textWrap: "balance" } as React.CSSProperties}>
            From network to <em className="not-italic text-[#4A90FF] font-normal">settlement</em>, fully onchain.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#1C2A52]">
          {/* Step 1 */}
          <div className="p-8 border-b md:border-b-0 md:border-r border-[#1C2A52]">
            <div className="font-mono text-[11px] tracking-[0.14em] text-[#8FA8D8]">STEP 01 · CREATE YOUR NETWORK</div>

            <h3 className="font-display text-2xl font-medium tracking-[-0.015em] mt-[18px] mb-3 text-white">Build your circle of trust</h3>
            <p className="text-[#8FA8D8] text-[15px] max-w-[340px]">
              Add friends, family, and businesses you know. Your social graph becomes the underwriting. Reputation you actually have, not a credit score.
            </p>
            <div className="mt-8 h-[180px] border border-[#1C2A52] rounded-[10px] relative overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(74,144,255,0.08)_0%,transparent_70%),#0E1A42]">
              <svg viewBox="0 0 280 180" className="w-full h-full block" role="img" aria-label="Animated network of connected nodes orbiting around a central point">
                <circle cx="140" cy="90" r="8" fill="white" />
                <circle cx="140" cy="90" r="50" fill="none" stroke="#4A90FF" strokeWidth="1" opacity="0.35" strokeDasharray="2 3" />
                <circle cx="140" cy="90" r="72" fill="none" stroke="#4A90FF" strokeWidth="1" opacity="0.2" strokeDasharray="2 3" />
                <g style={{ animation: "landing-orbit 12s linear infinite", transformOrigin: "50% 50%" }}>
                  <circle cx="190" cy="90" r="4" fill="#4A90FF" />
                  <circle cx="140" cy="40" r="4" fill="#4A90FF" />
                  <circle cx="90" cy="90" r="4" fill="#4A90FF" />
                  <circle cx="140" cy="140" r="4" fill="#4A90FF" />
                </g>
                <g style={{ animation: "landing-orbit 18s linear infinite reverse", transformOrigin: "50% 50%" }}>
                  <circle cx="212" cy="90" r="3" fill="#4A90FF" opacity="0.7" />
                  <circle cx="140" cy="18" r="3" fill="#4A90FF" opacity="0.7" />
                  <circle cx="68" cy="90" r="3" fill="#4A90FF" opacity="0.7" />
                  <circle cx="140" cy="162" r="3" fill="#4A90FF" opacity="0.7" />
                </g>
              </svg>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-8 border-b md:border-b-0 md:border-r border-[#1C2A52]">
            <div className="font-mono text-[11px] tracking-[0.14em] text-[#8FA8D8]">STEP 02 · CUSTOMIZE YOUR LOAN</div>
            <h3 className="font-display text-2xl font-medium tracking-[-0.015em] mt-[18px] mb-3 text-white">Set terms, sign onchain</h3>
            <p className="text-[#8FA8D8] text-[15px] max-w-[340px]">
              Amount, APY, duration, and collateral ratio are agreed between two people. The contract lives onchain, no paperwork, no middleman.
            </p>
            <div className="mt-8 h-[180px] border border-[#1C2A52] rounded-[10px] relative overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(74,144,255,0.08)_0%,transparent_70%),#0E1A42]">
              <svg viewBox="0 0 280 180" className="w-full h-full block" role="img" aria-label="Loan terms configuration panel with animated values">
                {/* Panel background */}
                <rect x="40" y="16" width="200" height="148" rx="8" fill="#162554" stroke="#2A3A6E" strokeWidth="1" />

                {/* Amount row */}
                <text x="60" y="44" style={{ fill: "#5D73A8", font: "500 8px 'JetBrains Mono', monospace" }}>AMOUNT</text>
                <text x="220" y="44" textAnchor="end" style={{ fill: "#fff", font: "600 11px 'JetBrains Mono', monospace" }}>500 USDC</text>
                <line x1="60" y1="52" x2="220" y2="52" stroke="#2A3A6E" strokeWidth="0.5" />

                {/* APY row */}
                <text x="60" y="72" style={{ fill: "#5D73A8", font: "500 8px 'JetBrains Mono', monospace" }}>APY</text>
                <text x="220" y="72" textAnchor="end" style={{ fill: "#fff", font: "600 11px 'JetBrains Mono', monospace" }}>8.5%</text>
                <line x1="60" y1="80" x2="220" y2="80" stroke="#2A3A6E" strokeWidth="0.5" />

                {/* Duration row */}
                <text x="60" y="100" style={{ fill: "#5D73A8", font: "500 8px 'JetBrains Mono', monospace" }}>DURATION</text>
                <text x="220" y="100" textAnchor="end" style={{ fill: "#fff", font: "600 11px 'JetBrains Mono', monospace" }}>30 DAYS</text>
                <line x1="60" y1="108" x2="220" y2="108" stroke="#2A3A6E" strokeWidth="0.5" />

                {/* Collateral row */}
                <text x="60" y="128" style={{ fill: "#5D73A8", font: "500 8px 'JetBrains Mono', monospace" }}>COLLATERAL</text>
                <text x="220" y="128" textAnchor="end" style={{ fill: "#fff", font: "600 11px 'JetBrains Mono', monospace" }}>150%</text>

                {/* Accept button with press animation */}
                <g style={{ animation: "landing-btnFlash 3s ease-in-out infinite", transformOrigin: "140px 150px" }}>
                  <rect x="100" y="140" width="80" height="20" rx="4" fill="#4A90FF" />
                  <text x="140" y="154" textAnchor="middle" style={{ fill: "#fff", font: "600 8px 'JetBrains Mono', monospace" }}>ACCEPT</text>
                </g>
                {/* Mouse cursor pointer */}
                <g style={{ animation: "landing-cursorClick 3s ease-in-out infinite" }}>
                  <path d="M148 158 L148 168 L152 165 L155 170 L157 169 L154 164 L158 163 Z" fill="#fff" stroke="#0A1230" strokeWidth="0.5" />
                </g>
              </svg>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-8">
            <div className="font-mono text-[11px] tracking-[0.14em] text-[#8FA8D8]">STEP 03 · CREATE LOAN</div>
            <h3 className="font-display text-2xl font-medium tracking-[-0.015em] mt-[18px] mb-3 text-white">Repayments settle onchain</h3>
            <p className="text-[#8FA8D8] text-[15px] max-w-[340px]">
              Borrower locks collateral, receives liquidity. On repayment, collateral returns automatically.
            </p>
            <div className="mt-8 h-[180px] border border-[#1C2A52] rounded-[10px] relative overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(74,144,255,0.08)_0%,transparent_70%),#0E1A42]">
              <svg viewBox="0 0 280 180" className="w-full h-full block" role="img" aria-label="Triangle flow: Agio vault at top, lender and borrower at base">
                {/* AGIO — icon image (top center) */}
                <circle cx="140" cy="30" r="16" fill="#162554" stroke="#4A90FF" strokeWidth="1.2" />
                <image href="/ecosystem/agio-icon-white.png" x="127" y="17" width="26" height="26" />
                <text x="140" y="56" textAnchor="middle" style={{ fill: "#8FA8D8", font: "600 7px 'JetBrains Mono', monospace" }}>AGIO</text>

                {/* Lender — person (bottom left) */}
                <circle cx="50" cy="140" r="16" fill="#162554" stroke="#4A90FF" strokeWidth="1.2" />
                <circle cx="50" cy="135" r="4.5" fill="#4A90FF" />
                <ellipse cx="50" cy="147" rx="7" ry="4.5" fill="#4A90FF" opacity="0.6" />
                <text x="50" y="166" textAnchor="middle" style={{ fill: "#8FA8D8", font: "600 7px 'JetBrains Mono', monospace" }}>LENDER</text>

                {/* Borrower — robot (bottom right) */}
                <circle cx="230" cy="140" r="16" fill="#162554" stroke="#4A90FF" strokeWidth="1.2" />
                <rect x="222" y="134" width="16" height="12" rx="2" fill="#4A90FF" opacity="0.8" />
                <circle cx="226" cy="139" r="1.5" fill="#fff" />
                <circle cx="234" cy="139" r="1.5" fill="#fff" />
                <line x1="230" y1="130" x2="230" y2="134" stroke="#4A90FF" strokeWidth="1" />
                <circle cx="230" cy="129" r="2" fill="#60A5FA" />
                <rect x="224" y="147" width="12" height="4" rx="1" fill="#4A90FF" opacity="0.5" />
                <text x="230" y="166" textAnchor="middle" style={{ fill: "#8FA8D8", font: "600 7px 'JetBrains Mono', monospace" }}>BORROWER</text>

                {/* Connecting lines (always visible) */}
                {/* Borrower ↔ Agio (right side diagonal) */}
                <line x1="218" y1="128" x2="153" y2="43" stroke="#2A3A6E" strokeWidth="1" strokeDasharray="3 3" />
                {/* Lender ↔ Borrower (bottom horizontal) */}
                <line x1="68" y1="140" x2="212" y2="140" stroke="#2A3A6E" strokeWidth="1" strokeDasharray="3 3" />
                {/* Agio ↔ Lender (left side diagonal) — not used for flow but closes triangle */}

                {/* Labels on lines */}
                {/* COLLATERAL — aligned along the diagonal, with arrows */}
                <text textAnchor="middle" style={{ fill: "#60A5FA", font: "500 6px 'JetBrains Mono', monospace" }} transform="translate(192,81) rotate(52.5)">← COLLATERAL →</text>
                <text x="140" y="135" textAnchor="middle" style={{ fill: "#4A90FF", font: "500 6px 'JetBrains Mono', monospace" }}>LIQUIDITY →</text>
                <text x="140" y="152" textAnchor="middle" style={{ fill: "#3B82F6", font: "500 6px 'JetBrains Mono', monospace" }}>← REPAYMENT</text>

                {/* Sequential loan cycle — exactly 4 balls, one per phase, 8s total */}
                {/* Phase 1: Borrower → Agio (collateral lock) — starts at Borrower edge */}
                <circle cx="220" cy="128" r="3.5" fill="#60A5FA" style={{ animation: "loan-collateral 8s ease-in-out infinite" }} />

                {/* Phase 2: Lender → Borrower (liquidity sent) — starts at Lender edge */}
                <circle cx="66" cy="140" r="3.5" fill="#4A90FF" style={{ animation: "loan-liquidity 8s ease-in-out infinite" }} />

                {/* Phase 3: Borrower → Lender (repayment) — starts at Borrower edge */}
                <circle cx="214" cy="140" r="3.5" fill="#3B82F6" style={{ animation: "loan-repayment 8s ease-in-out infinite" }} />

                {/* Phase 4: Agio → Borrower (collateral return) — starts at Agio edge */}
                <circle cx="150" cy="42" r="3.5" fill="#60A5FA" style={{ animation: "loan-return 8s ease-in-out infinite" }} />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
