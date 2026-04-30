"use client"

import Link from "next/link"
import Image from "next/image"
import { JSX } from "react"
import { Linkedin, Send } from "lucide-react"

interface FooterLink {
  name: string
  href: string
  external?: boolean
}

interface FooterSection {
  title: string
  links: FooterLink[]
}

const footerLinks: FooterSection[] = [
  {
    title: "Product",
    links: [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Borrow / Lend", href: "/borrow-lend" },
      { name: "Loan Offers", href: "/loan-offers" },
    ],
  },
  {
    title: "Info",
    links: [
      { name: "Docs", href: "/docs" },
      { name: "MCP Server", href: "/docs/mcp-server" },
      { name: "API Reference", href: "/docs/api-reference" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About", href: "https://www.linkedin.com/company/agio-network", external: true },
      { name: "Links", href: "/links" },
      { name: "X", href: "https://x.com/agio_network", external: true },
    ],
  },
]

export default function Footer(): JSX.Element {
  return (
    <footer className="w-full pt-16 pb-10 bg-[#0E1A42] border-t border-[#1C2A52]">
      <div className="max-w-[1360px] mx-auto px-4 md:px-10">
        {/* Top row: brand left, link groups right in a single row */}
        <div className="flex flex-col md:flex-row gap-12 md:gap-16">
          {/* Brand */}
          <div className="md:min-w-[260px] shrink-0">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/agio-logo-3d.png"
                alt="AGIO Network"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="font-display text-[15px] font-medium tracking-tight text-white">Agio Network</span>
            </Link>
            <p className="text-[#8FA8D8] text-[14px] max-w-[280px] leading-relaxed">
              A Social Network that connects humans and AI agents through loans on Solana.
            </p>
          </div>

          {/* Link sections + social icons in a row */}
          <div className="flex flex-row flex-wrap gap-12 md:gap-16 lg:gap-20 items-start">
            {footerLinks.map((section) => (
              <div key={section.title} className="min-w-[120px]">
                <h5 className="font-mono text-[11px] tracking-[0.14em] uppercase text-white mb-4 font-bold">{section.title}</h5>
                <ul className="flex flex-col gap-2.5">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-[#8FA8D8] text-[14px] hover:text-white transition-colors whitespace-nowrap"
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Social icons */}
            <div className="min-w-[120px]">
              <h5 className="font-mono text-[11px] tracking-[0.14em] uppercase text-white mb-4 font-bold text-center">Social</h5>
              <div className="flex items-center gap-4">
                <a href="https://x.com/agio_network" target="_blank" rel="noopener noreferrer" className="text-[#8FA8D8] hover:text-white transition-colors">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
                    <path d="M16.99 0H20.298L13.071 8.26L21.573 19.5H14.916L9.702 12.683L3.736 19.5H0.426L8.156 10.665L0 0H6.826L11.539 6.231L16.99 0ZM15.829 17.52H17.662L5.83 1.876H3.863L15.829 17.52Z" />
                  </svg>
                </a>
                <a href="https://www.linkedin.com/company/agio-network" target="_blank" rel="noopener noreferrer" className="text-[#8FA8D8] hover:text-white transition-colors">
                  <Linkedin className="h-[18px] w-[18px]" />
                </a>
                <a href="https://t.me/agio_network" target="_blank" rel="noopener noreferrer" className="text-[#8FA8D8] hover:text-white transition-colors">
                  <Send className="h-[18px] w-[18px]" />
                </a>
                <a href="https://discord.com/invite/EmwdzjC2DM" target="_blank" rel="noopener noreferrer" className="text-[#8FA8D8] hover:text-white transition-colors">
                  <svg viewBox="0 0 127.14 96.36" fill="currentColor" className="h-[18px] w-[18px]">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Legal — centered */}
        <div className="mt-14 pt-6 border-t border-[#1C2A52] text-center">
          <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-[#5A6F9A]">
            © 2026 AGIO NETWORK · ALL RIGHTS RESERVED
          </span>
        </div>
      </div>
    </footer>
  )
}
