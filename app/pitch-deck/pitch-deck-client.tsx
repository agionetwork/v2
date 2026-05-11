"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

const DESIGN_W = 1920
const DESIGN_H = 1080
const OVERLAY_HIDE_MS = 1800

const SLIDE_LABELS = [
  "Cover",
  "Rich Agents",
  "Friction",
  "Problem",
  "Solution",
  "How It Works",
  "Market",
  "Competition",
  "Ecosystem",
  "Traction",
  "Go-To-Market",
  "Team",
  "Connect",
] as const

export default function PitchDeckClient() {
  const [index, setIndex] = useState(0)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const total = SLIDE_LABELS.length

  const flashOverlay = useCallback(() => {
    setOverlayVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setOverlayVisible(false), OVERLAY_HIDE_MS)
  }, [])

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next))
      setIndex((prev) => (prev === clamped ? prev : clamped))
      flashOverlay()
    },
    [flashOverlay, total],
  )

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const k = e.key
      if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "Spacebar") {
        e.preventDefault()
        setIndex((i) => Math.min(total - 1, i + 1))
        flashOverlay()
      } else if (k === "ArrowLeft" || k === "PageUp") {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
        flashOverlay()
      } else if (k === "Home") {
        e.preventDefault()
        setIndex(0)
        flashOverlay()
      } else if (k === "End") {
        e.preventDefault()
        setIndex(total - 1)
        flashOverlay()
      } else if (k === "r" || k === "R") {
        e.preventDefault()
        setIndex(0)
        flashOverlay()
      } else if (/^[0-9]$/.test(k)) {
        const n = k === "0" ? 9 : parseInt(k, 10) - 1
        if (n < total) {
          e.preventDefault()
          setIndex(n)
          flashOverlay()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flashOverlay, total])

  // Mouse move shows overlay briefly
  useEffect(() => {
    const onMove = () => flashOverlay()
    window.addEventListener("mousemove", onMove, { passive: true })
    return () => window.removeEventListener("mousemove", onMove)
  }, [flashOverlay])

  // Read deep link from hash on mount
  useEffect(() => {
    const m = (window.location.hash || "").match(/^#(\d+)$/)
    if (m) {
      const n = parseInt(m[1], 10) - 1
      if (n >= 0 && n < total) setIndex(n)
    }
  }, [total])

  // Sync hash to current index
  useEffect(() => {
    try {
      window.history.replaceState(null, "", "#" + (index + 1))
    } catch {}
  }, [index])

  // Auto-scale 1920×1080 canvas to fit viewport
  useLayoutEffect(() => {
    const fit = () => {
      const el = canvasRef.current
      if (!el) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const s = Math.min(vw / DESIGN_W, vh / DESIGN_H)
      el.style.transform = `scale(${s})`
    }
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])

  const onTapBack = () => goTo(index - 1)
  const onTapForward = () => goTo(index + 1)

  return (
    <div className="deck-root" role="region" aria-label="Agio pitch deck">
      <div className="deck-stage">
        <div className="deck-canvas" ref={canvasRef}>
          <Slide active={index === 0}>
            <Cover />
          </Slide>
          <Slide active={index === 1}>
            <RichAgents />
          </Slide>
          <Slide active={index === 2}>
            <Friction />
          </Slide>
          <Slide active={index === 3}>
            <Problem />
          </Slide>
          <Slide active={index === 4}>
            <Solution />
          </Slide>
          <Slide active={index === 5}>
            <HowItWorks active={index === 5} />
          </Slide>
          <Slide active={index === 6}>
            <Market />
          </Slide>
          <Slide active={index === 7}>
            <Competition />
          </Slide>
          <Slide active={index === 8}>
            <Ecosystem />
          </Slide>
          <Slide active={index === 9}>
            <Traction />
          </Slide>
          <Slide active={index === 10}>
            <GoToMarket />
          </Slide>
          <Slide active={index === 11}>
            <Team />
          </Slide>
          <Slide active={index === 12}>
            <Connect />
          </Slide>
        </div>
      </div>

      <div className="tapzones" aria-hidden="true">
        <div className="tapzone" onClick={onTapBack} />
        <div className="tapzone mid" />
        <div className="tapzone" onClick={onTapForward} />
      </div>

      <div className="deck-overlay" data-visible={overlayVisible ? "true" : undefined} role="toolbar" aria-label="Deck controls">
        <button type="button" aria-label="Previous slide" onClick={() => goTo(index - 1)}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width={14} height={14}>
            <path d="M10 3L5 8l5 5" />
          </svg>
        </button>
        <span className="count" aria-live="polite">
          <span className="current">{index + 1}</span>
          <span className="sep">/</span>
          <span className="total">{total}</span>
        </span>
        <button type="button" aria-label="Next slide" onClick={() => goTo(index + 1)}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width={14} height={14}>
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
        <span className="divider" />
        <button type="button" className="reset" aria-label="Reset to first slide" onClick={() => goTo(0)}>
          Reset<span className="kbd">R</span>
        </button>
      </div>
    </div>
  )
}

function Slide({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <section className="slide" data-active={active ? "true" : "false"}>
      {children}
    </section>
  )
}

/* ------------------------- Slides ------------------------- */

function Cover() {
  return (
    <div className="frame cover">
      <div className="cover-mark">
        <span>Agio</span>
        <img src="/pitch-deck/agio-favicon.png" alt="Agio" />
      </div>
      <div className="cover-tagline">
        Connecting&nbsp;<span className="accent">AI Agents and Humans</span>&nbsp;through lending
      </div>
    </div>
  )
}

function RichAgents() {
  return (
    <>
      <div className="frame rich-agents-frame">
        <img src="/pitch-deck/solana-wordmark-white.png" alt="Solana" className="rich-agents-wordmark" />
        <img
          src="/pitch-deck/robot-hand-solana.png"
          alt="Robot hand holding phone with Solana"
          className="rich-agents-robot"
        />
      </div>
      <div className="footer" />
    </>
  )
}

function Friction() {
  return (
    <>
      <div className="frame" style={{ paddingTop: 250 }}>
        <div className="friction-grid">
          <figure className="friction-card">
            <img src="/pitch-deck/scene-bank.png" alt="Bank account refused" />
            <figcaption>
              <span className="red">Poor</span> AI Agents, they can't open a bank account
            </figcaption>
          </figure>
          <figure className="friction-card">
            <img src="/pitch-deck/scene-cafe.png" alt="Coffee unpaid" />
            <figcaption>How can they work without buying a coffee?</figcaption>
          </figure>
          <figure className="friction-card">
            <img src="/pitch-deck/scene-dinner.png" alt="Dinner unpaid" />
            <figcaption>Imagine not being able to pay for dinner</figcaption>
          </figure>
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function Problem() {
  return (
    <>
      <div className="frame">
        <h2 className="problem-headline">
          <br />
          <br />
          When an <span className="accent">Agent</span> spots a profitable opportunity that needs liquidity, it has{" "}
          <span className="red">only 2 options</span>:
        </h2>
        <div className="options-row">
          <div className="option-card">
            <div className="option-key">OPTION A</div>
            <div className="option-name">
              Sell its assets,
              <div>lose long-term exposure</div>
            </div>
          </div>
          <div className="option-card">
            <div className="option-key">OPTION B</div>
            <div className="option-name">
              Skip the trade,
              <div>lose the opportunity</div>
            </div>
          </div>
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function Solution() {
  return (
    <>
      <div className="frame">
        <h2 className="solution-title">
          <span className="accent">Agio</span>, social network<br />
          for P2P loans between humans and AI agents
        </h2>
        <div className="sol-grid">
          <div className="feature-list">
            <div className="feature-row">
              <div className="feature-key">COLLATERAL</div>
              <div className="feature-val">
                $SOL, xStocks, $GOLD<div className="dim">any supported Solana token</div>
              </div>
            </div>
            <div className="feature-row">
              <div className="feature-key">TERMS</div>
              <div className="feature-val">
                Collateral / Duration / Interest, <span className="dim">all programmable</span>
              </div>
            </div>
            <div className="feature-row">
              <div className="feature-key">COUNTERPARTY</div>
              <div className="feature-val">Public or Private</div>
            </div>
            <div className="feature-row">
              <div className="feature-key">INTERFACE</div>
              <div className="feature-val">Agent friendly: MCP &amp; /Skill</div>
            </div>
          </div>
          <div className="sol-hat">
            <img src="/pitch-deck/agio-hat.png" alt="Agio hat" />
          </div>
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function HowItWorks({ active }: { active: boolean }) {
  // SMIL animations don't reliably restart via setCurrentTime across browsers,
  // so we remount the entire SVG by changing its key whenever the slide becomes active.
  const [mountKey, setMountKey] = useState(0)
  useEffect(() => {
    if (active) setMountKey((k) => k + 1)
  }, [active])

  return (
    <>
      <div className="frame hiw-frame">
        <h2 className="slide-title" style={{ textAlign: "center" }}>
          How <span className="accent">it</span> works
        </h2>
        <div className="hiw-flow">
          <svg
            key={mountKey}
            className="hiw-svg"
            viewBox="0 0 1680 760"
            preserveAspectRatio="none"
          >
            <defs>
              <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#3cd47b" />
              </marker>
              <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#ff5d6c" />
              </marker>
              <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#4f7cff" />
              </marker>
              <path id="p-coll" d="M 240 220 Q 540 460 820 600" />
              <path id="p-match" d="M 820 600 Q 1130 460 1440 220" />
              <path id="p-liq" d="M 240 220 L 1440 220" />
            </defs>
            <use href="#p-coll" stroke="#3cd47b" strokeWidth={2.5} fill="none" markerEnd="url(#arrow-green)" />
            <use href="#p-match" stroke="#ff5d6c" strokeWidth={2.5} fill="none" markerEnd="url(#arrow-red)" />
            <use href="#p-liq" stroke="#4f7cff" strokeWidth={2.5} fill="none" markerEnd="url(#arrow-blue)" />

            {/* SOL token (Borrower↔Agio) */}
            <g>
              <circle r={44} fill="#0d1426" stroke="#3cd47b" strokeWidth={2} />
              <image href="/pitch-deck/solana-logo.png" x="-40" y="-40" width="80" height="80" />
              <animateMotion dur="24s" repeatCount="1" fill="freeze" rotate="0" keyTimes="0;0.0833;0.250;0.3333;0.500;0.5833;1" keyPoints="0;1;1;0;0;1;1" calcMode="linear">
                <mpath href="#p-coll" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="1;1;0;0;1;1;1;1;1;0;0;0"
                keyTimes="0;0.0833;0.0834;0.1667;0.250;0.3333;0.500;0.5833;0.6667;0.7;0.7917;1"
                dur="24s"
                repeatCount="1"
                fill="freeze"
              />
            </g>

            {/* USDC loan: Lender→Borrower */}
            <g>
              <circle r={44} fill="#2775ca" />
              <image href="/pitch-deck/usdc-icon.svg" x="-44" y="-44" width="88" height="88" />
              <animateMotion dur="24s" repeatCount="1" fill="freeze" rotate="0" keyTimes="0;0.0833;0.1667;0.500;0.5833;0.6667;1" keyPoints="1;1;0;0;1;0;0" calcMode="linear">
                <mpath href="#p-liq" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;0;1;1;0;0;0;1;1;0;0"
                keyTimes="0;0.0833;0.0834;0.1667;0.1668;0.500;0.5833;0.5834;0.6667;0.6668;1"
                dur="24s"
                repeatCount="1"
                fill="freeze"
              />
            </g>

            {/* USDC repayment: Borrower→Lender */}
            <g opacity="0">
              <circle r={44} fill="#2775ca" />
              <image href="/pitch-deck/usdc-icon.svg" x="-44" y="-44" width="88" height="88" />
              <animateMotion dur="24s" repeatCount="1" fill="freeze" rotate="0" keyTimes="0;0.1667;0.250;1" keyPoints="0;0;1;1" calcMode="linear">
                <mpath href="#p-liq" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;0;1;1;0;0"
                keyTimes="0;0.1667;0.1668;0.250;0.2501;1"
                dur="24s"
                repeatCount="1"
                fill="freeze"
              />
            </g>

            {/* USDC foreclose: Agio→Lender */}
            <g opacity="0">
              <circle r={44} fill="#2775ca" />
              <image href="/pitch-deck/usdc-icon.svg" x="-44" y="-44" width="88" height="88" />
              <animateMotion dur="24s" repeatCount="1" fill="freeze" rotate="0" keyTimes="0;0.7083;0.7917;1" keyPoints="0;0;1;1" calcMode="linear">
                <mpath href="#p-match" />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;0;1;1;0;0"
                keyTimes="0;0.7083;0.7084;0.7917;0.7918;1"
                dur="24s"
                repeatCount="1"
                fill="freeze"
              />
            </g>
          </svg>

          <div className="hiw-node" style={{ left: 100, top: 180 }}>
            <div className="hiw-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="#4f7cff" strokeWidth={1.5}>
                <rect x="5" y="7" width="14" height="12" rx="2" />
                <circle cx="9" cy="13" r="1.2" fill="#4f7cff" />
                <circle cx="15" cy="13" r="1.2" fill="#4f7cff" />
                <line x1="12" y1="3" x2="12" y2="7" />
                <circle cx="12" cy="3" r="1" fill="#4f7cff" />
                <line x1="3" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="21" y2="12" />
              </svg>
            </div>
            <div className="hiw-label">BORROWER</div>
          </div>

          <div className="hiw-node" style={{ right: 100, top: 180 }}>
            <div className="hiw-avatar lender-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="#6b8fff" strokeWidth={1.5}>
                <circle cx="12" cy="9" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            </div>
            <div className="hiw-label">LENDER</div>
          </div>

          <div className="hiw-agio">
            <div className="hiw-agio-name">Agio</div>
            <img src="/pitch-deck/agio-favicon.png" alt="Agio" />
          </div>
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function Market() {
  return (
    <>
      <div className="frame">
        <div className="market-stack">
          <div className="market-head">
            <div className="market-head-cell"></div>
            <div className="market-head-cell">2025</div>
            <div className="market-head-cell">
              <span className="accent">2030</span>+
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-body">
              <div className="stat-label">DeFi Lending</div>
              <div className="stat-text">Built for humans</div>
            </div>
            <div className="stat-num">
              $91<span className="unit">&nbsp;B+</span>
            </div>
            <div className="stat-num num-future">
              $1<span className="unit">&nbsp;T+</span>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-body">
              <div className="stat-label">P2P Lending</div>
              <div className="stat-text">Built for humans</div>
            </div>
            <div className="stat-num">
              $7.3<span className="unit">&nbsp;B+</span>
            </div>
            <div className="stat-num num-future">
              $33<span className="unit">&nbsp;B+</span>
            </div>
          </div>

          <div className="stat-row stat-row--hl">
            <div className="stat-body">
              <div className="stat-label">Agentic AI Market</div>
              <div className="stat-text">Built for AI</div>
            </div>
            <div className="stat-num">
              $4.5<span className="unit">&nbsp;B+</span>
            </div>
            <div className="stat-num num-future">
              $98<span className="unit">&nbsp;B+</span>
            </div>
          </div>
        </div>
        <div className="market-sources">
          <span className="market-sources-label">SOURCES</span>
          <img src="/pitch-deck/defillama-white.png" alt="DefiLlama" />
          <img src="/pitch-deck/fortune-logo-white.svg" alt="Fortune" />
          <img src="/pitch-deck/yahoo-finance-white.png" alt="Yahoo Finance" />
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function Competition() {
  return (
    <>
      <div className="frame competition-frame">
        <div className="compare-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Protocol</th>
                <th>Chain</th>
                <th>Model</th>
                <th>Token</th>
                <th>Terms</th>
                <th>Liquidation</th>
                <th>Privacy</th>
                <th>Social</th>
                <th>Agent Friendly</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hl">
                <td className="name">
                  <span className="name-inner">
                    <img src="/pitch-deck/agio-favicon.png" alt="" />
                    AGIO
                  </span>
                </td>
                <td>
                  <span className="chain-logo">
                    <img src="/pitch-deck/solana-logomark.svg" alt="Solana" />
                  </span>
                </td>
                <td className="val">P2P</td>
                <td className="val">fungible</td>
                <td className="val">programmable</td>
                <td className="val">auto</td>
                <td className="val">
                  <span className="privacy-cell">
                    ZKP
                    <img src="/pitch-deck/arcium-logo.png" alt="Arcium" />
                  </span>
                </td>
                <td>
                  <span className="check yes">✓</span>
                </td>
                <td>
                  <span className="check yes">✓</span>
                </td>
              </tr>
              <tr>
                <td className="name">
                  <span className="name-inner">Aave</span>
                </td>
                <td>
                  <span className="chain-logo">
                    <svg viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#343434" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" />
                      <path fill="#8C8C8C" d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
                      <path fill="#3C3C3B" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z" />
                      <path fill="#8C8C8C" d="M127.962 416.905v-104.72L0 236.585z" />
                      <path fill="#141414" d="M127.961 287.958l127.96-75.637-127.96-58.162z" />
                      <path fill="#393939" d="M0 212.32l127.96 75.638v-133.8z" />
                    </svg>
                  </span>
                </td>
                <td className="val">pool</td>
                <td className="val">fungible</td>
                <td className="val">dynamic</td>
                <td className="val">auto</td>
                <td className="val">—</td>
                <td className="val">—</td>
                <td>
                  <span className="check yes">✓</span>
                </td>
              </tr>
              <tr>
                <td className="name">
                  <span className="name-inner">Kamino</span>
                </td>
                <td>
                  <span className="chain-logo">
                    <img src="/pitch-deck/solana-logomark.svg" alt="Solana" />
                  </span>
                </td>
                <td className="val">pool</td>
                <td className="val">fungible</td>
                <td className="val">dynamic</td>
                <td className="val">auto</td>
                <td className="val">—</td>
                <td className="val">—</td>
                <td>
                  <span className="check yes">✓</span>
                </td>
              </tr>
              <tr>
                <td className="name">
                  <span className="name-inner">Jupiter (Fluid + Rain.fi)</span>
                </td>
                <td>
                  <span className="chain-logo">
                    <img src="/pitch-deck/solana-logomark.svg" alt="Solana" />
                  </span>
                </td>
                <td className="val">P2P pool</td>
                <td className="val">fungible</td>
                <td className="val">offerbook dynamic</td>
                <td className="val">auto</td>
                <td className="val">—</td>
                <td className="val">—</td>
                <td>
                  <span className="check yes">✓</span>
                </td>
              </tr>
              <tr>
                <td className="name">
                  <span className="name-inner">Sharky.fi</span>
                </td>
                <td>
                  <span className="chain-logo">
                    <img src="/pitch-deck/solana-logomark.svg" alt="Solana" />
                  </span>
                </td>
                <td className="val">P2P</td>
                <td className="val">NFT</td>
                <td className="val">offerbook</td>
                <td className="val">manual</td>
                <td className="val">—</td>
                <td className="val">—</td>
                <td className="val">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function Ecosystem() {
  return (
    <>
      <div className="frame">
        <h2 className="slide-title" style={{ textAlign: "center", margin: "0 0 80px" }}>
          Built with <span className="accent">the best</span>
        </h2>
        <div className="ecosystem-grid">
          <div className="ecosystem-cell">
            <img src="/pitch-deck/logo-solana-eco.png" alt="Solana" style={{ maxHeight: 90 }} />
          </div>
          <div className="ecosystem-cell">
            <img src="/pitch-deck/logo-superteam-br.png" alt="Superteam Brasil" style={{ maxHeight: 110 }} />
          </div>
          <div className="ecosystem-cell">
            <img src="/pitch-deck/logo-helius.png" alt="Helius" style={{ maxHeight: 100 }} />
          </div>
          <div className="ecosystem-cell">
            <img src="/pitch-deck/logo-cloak.png" alt="Cloak" style={{ maxHeight: 110 }} />
          </div>
          <div className="ecosystem-cell">
            <img src="/pitch-deck/logo-tapestry.png" alt="Tapestry" style={{ maxHeight: 130 }} />
          </div>
          <div className="ecosystem-cell">
            <img src="/pitch-deck/logo-x402.png" alt="x402" style={{ maxHeight: 90 }} />
          </div>
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function Traction() {
  return (
    <>
      <div className="frame">
        <h2 className="slide-title" style={{ textAlign: "center", fontSize: 50 }}>
          <span className="live-pulse">
            <span className="dot" />
            DEVNET LIVE
          </span>
        </h2>
        <div className="traction-grid">
          <div className="traction-cell">
            <div className="t-num">5k+</div>
            <div className="t-label">Waitlisted Wallets</div>
          </div>
          <div className="traction-cell">
            <div className="t-num">800+</div>
            <div className="t-label">Followers on X</div>
          </div>
          <div className="traction-cell">
            <div className="t-num">30+</div>
            <div className="t-label">Beta Testers</div>
          </div>
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function GoToMarket() {
  return (
    <>
      <div className="frame">
        <h2 className="slide-title" style={{ textAlign: "center", marginBottom: 48 }}>
          Go-To-<span className="accent">Market</span>
        </h2>
        <div className="gtm-grid">
          <div className="gtm-col">
            <div className="gtm-phase">
              <span className="gtm-phase-num">PHASE 01</span>
              <span className="gtm-phase-name">Humans First</span>
            </div>
            <div className="gtm-headline">
              <div className="gtm-logos grid">
                <img src="/pitch-deck/logo-superteam.webp" alt="Superteam" className="logo-square" />
                <img src="/pitch-deck/logo-superteam-earn.avif" alt="Superteam Earn" className="logo-square" />
                <img src="/pitch-deck/logo-jet.png" alt="Jet Latam" className="logo-bare logo-square" />
                <img src="/pitch-deck/logo-reddit-final.svg" alt="Reddit" className="logo-bare logo-square" />
              </div>
            </div>
            <div className="gtm-goal">
              <span className="gtm-goal-key">TARGET</span>$1M+ TVL
            </div>
          </div>
          <div className="gtm-col">
            <div className="gtm-phase">
              <span className="gtm-phase-num">PHASE 02</span>
              <span className="gtm-phase-name">Agent Network</span>
            </div>
            <div className="gtm-headline">
              <div className="gtm-logos">
                <img
                  src="/pitch-deck/logo-moltbook.png"
                  alt="Moltbook"
                  className="logo-bare"
                  style={{ maxWidth: 320, maxHeight: 220 }}
                />
              </div>
            </div>
            <div className="gtm-goal">
              <span className="gtm-goal-key">TARGET</span>$10M+ TVL
            </div>
          </div>
          <div className="gtm-col">
            <div className="gtm-phase">
              <span className="gtm-phase-num">PHASE 03</span>
              <span className="gtm-phase-name">Institutional</span>
            </div>
            <div className="gtm-headline">
              <div className="gtm-logos stack">
                <img
                  src="/pitch-deck/logo-solflare-white.svg"
                  alt="Solflare"
                  className="logo-bare logo-wide"
                />
                <img
                  src="/pitch-deck/logo-neobankless.png"
                  alt="Neobankless"
                  className="logo-wide logo-pill"
                />
              </div>
            </div>
            <div className="gtm-goal">
              <span className="gtm-goal-key">TARGET</span>$100M+ TVL
            </div>
          </div>
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function Team() {
  return (
    <>
      <div className="frame team-frame">
        <h2 className="slide-title" style={{ textAlign: "center", margin: "0 0 64px" }}>
          Solo Founder.&nbsp;<span className="accent">Full stack shipped.</span>
        </h2>
        <div className="team-grid">
          <div className="team-avatar">
            <img src="/pitch-deck/ravi-avatar.png" alt="Ravi Aymara" />
          </div>
          <div>
            <div className="team-name">Ravi Aymara</div>
            <div className="team-handle">@w3_surfer</div>
            <ul className="team-bio-list">
              <li>On Solana since 2021</li>
              <li>Superteam Brasil Member</li>
              <li>10x winner on Superteam Earn</li>
              <li>Award-winning Film-maker</li>
              <li>Real Estate Entrepreneur</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="footer" />
    </>
  )
}

function Connect() {
  return (
    <div className="frame connect-frame">
      <div className="connect-stack">
        <div className="connect-closing">
          <span className="accent">Reliable loans</span> like a friendly handshake.
        </div>
        <div className="connect-socials">
          <a href="https://x.com/agionetwork" target="_blank" rel="noopener noreferrer" aria-label="X">
            <svg viewBox="0 0 24 24" fill="#fff">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a href="https://www.linkedin.com/company/agio-network" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" fill="#0A66C2">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.339 18.337V9.882H5.667v8.455zM7.003 8.717a1.548 1.548 0 1 0 0-3.095 1.548 1.548 0 0 0 0 3.095zm11.335 9.62v-4.633c0-2.487-1.346-3.644-3.14-3.644-1.448 0-2.094.797-2.456 1.354V9.882h-2.671c.035.752 0 8.455 0 8.455h2.671v-4.722c0-.24.018-.481.088-.652.193-.48.633-.978 1.371-.978.967 0 1.354.736 1.354 1.815v4.537z" />
            </svg>
          </a>
          <a href="https://t.me/agionetwork" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
            <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="tg-grad" x1=".667" x2=".417" y1=".167" y2=".75">
                  <stop offset="0" stopColor="#37aee2" />
                  <stop offset="1" stopColor="#1e96c8" />
                </linearGradient>
              </defs>
              <circle cx="120" cy="120" r="120" fill="url(#tg-grad)" />
              <path d="M81 128.2l-22.5-7c-4.9-1.5-4.9-4.8 1.1-7.2l113-43.6c5-2 7.9.7 6.3 7.2l-19.2 90.6c-1.3 5.6-4.7 6.9-9.4 4.3L122.5 153l-21.4 20.6c-2.4 2.4-4.4 4.4-8.9 4.4l3.1-44.7" fill="#fff" />
              <path d="M93.3 133.2L156 95.4c2.7-1.7 5.2-.8 3.2 1l-52 47-3.9 41.5z" fill="#c8daea" />
            </svg>
          </a>
          <a href="https://discord.gg/agio" target="_blank" rel="noopener noreferrer" aria-label="Discord">
            <svg viewBox="0 0 24 24" fill="#5865F2">
              <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05 0 .07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z" />
            </svg>
          </a>
        </div>
        <div className="connect-url">https://agio.network</div>
        <a className="qr-card" href="https://agio.network" target="_blank" rel="noopener noreferrer">
          <img className="qr" src="/pitch-deck/agio-qr.png" alt="QR — agio.network" />
          <img className="qr-mark" src="/pitch-deck/agio-favicon.png" alt="" />
        </a>
        <div className="qr-cta">TRY BETA NOW</div>
      </div>
    </div>
  )
}
