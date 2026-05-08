"use client"

import Image from "next/image"

// Order: Solana, Superteam, Cloak, Privy, Tapestry, x402
// Images are trimmed (no transparent padding) so object-fit works accurately
// scale: per-logo size tweak (1 = default BOX bounds, <1 = smaller)
const partners = [
  { name: "Solana", logo: "/ecosystem/solana.png", w: 1287, h: 193, scale: 1 },
  { name: "Helius", logo: "/ecosystem/helius.png", w: 1441, h: 590, scale: 0.95 },
  { name: "Superteam Brasil", logo: "/ecosystem/superteam-brasil.png", w: 497, h: 80, scale: 1 },
  { name: "Cloak", logo: "/ecosystem/cloak.svg", w: 1738, h: 473, scale: 0.85 },
  { name: "Privy", logo: "/ecosystem/privy.png", w: 1304, h: 298, scale: 0.78 },
  { name: "Tapestry", logo: "/ecosystem/tapestry.png", w: 1496, h: 582, scale: 1 },
  { name: "x402", logo: "/ecosystem/x402.png", w: 389, h: 152, scale: 0.78 },
]

// Uniform bounding box per logo — object-fit: contain fills it proportionally
const BOX_W = 180
const BOX_H = 56
const GAP = 80 // visual gap between logos

// Each slot = BOX_W + GAP so the loop is pixel-perfect (no CSS gap, spacing
// is baked into the slot width)
const SLOT_W = BOX_W + GAP

// Total pixel width of one copy of the partners — used as the exact loop
// distance for the marquee. Avoids subpixel rounding errors that come with
// using a percentage on a flex container.
const LOOP_W = partners.length * SLOT_W

// Tune the duration to keep apparent speed constant regardless of how many
// partners are on the strip (about 240px/sec).
const SCROLL_DURATION_S = Math.max(8, Math.round(LOOP_W / 100))

// Two copies for seamless infinite loop
const track = [...partners, ...partners]

export function EcosystemCarousel() {
  return (
    <section className="py-20 border-b border-[#1C2A52] relative bg-[#0A1230]">
      <div className="max-w-[1360px] mx-auto px-4 md:px-10">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-6 md:gap-12 mb-14">
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#8FA8D8] pt-3">
            04 / ECOSYSTEM
          </div>
          <h2
            className="font-display font-medium text-[clamp(32px,3.6vw,52px)] leading-[1.05] tracking-[-0.022em] text-white"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Built with the <em className="not-italic text-[#4A90FF] font-normal">best</em>.
          </h2>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative overflow-hidden">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-[#0A1230] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-[#0A1230] to-transparent" />

        <div
          className="flex items-center animate-scroll-x"
          style={
            {
              willChange: "transform",
              "--marquee-w": `${LOOP_W}px`,
              "--marquee-duration": `${SCROLL_DURATION_S}s`,
            } as React.CSSProperties
          }
        >
          {track.map((p, i) => (
            <div
              key={`${p.name}-${i}`}
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: SLOT_W, height: BOX_H }}
            >
              <Image
                src={p.logo}
                alt={p.name}
                width={p.w}
                height={p.h}
                className="object-contain opacity-70 hover:opacity-100 transition-opacity duration-300"
                style={{ maxWidth: BOX_W * p.scale, maxHeight: BOX_H * p.scale, width: "auto", height: "auto" }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
