"use client"

import Link from "next/link"
import Image from "next/image"
import { Menu, X } from "lucide-react"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"

const NAV_LINKS = [
  { label: "How it works?", href: "#protocol" },
  { label: "Why Agio?", href: "#why-agio" },
  { label: "Statistics", href: "#statistics" },
  { label: "Docs", href: "/docs" },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled || menuOpen ? "bg-[#0A1230]/95 backdrop-blur-md border-b border-[#1C2A52]" : "bg-transparent"}`}>
      <div className="max-w-[1360px] mx-auto flex h-16 items-center justify-between px-4 md:px-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/agio-logo-3d.png"
              alt="AGIO Network"
              width={36}
              height={36}
              className="object-contain"
            />
            <span className="font-display text-[15px] font-medium tracking-tight text-white">Agio Network</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-[rgba(74,144,255,0.25)] rounded-full font-mono text-[10px] tracking-[0.1em] uppercase text-[#4A90FF] bg-[rgba(74,144,255,0.08)]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444] animate-[landing-pulse_1.6s_ease-in-out_infinite]" />
            DEVNET LIVE
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="font-mono text-[12px] tracking-[0.06em] uppercase text-[#8FA8D8] hover:text-white transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/borrow-lend"
            data-slot="button"
            data-variant="default"
            className="inline-flex items-center justify-center px-5 py-2 text-[13px] font-display font-medium text-white rounded-lg uppercase tracking-wider"
          >
            LAUNCH APP
          </Link>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 text-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-[#1C2A52] bg-[#0A1230]/95 backdrop-blur-md px-4 py-4 flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-mono text-[13px] tracking-[0.06em] uppercase text-[#8FA8D8] hover:text-white transition-colors py-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
