"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Linkedin,
  Send,
  FileText,
  Globe,
} from "lucide-react"

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16.99 0H20.298L13.071 8.26L21.573 19.5H14.916L9.702 12.683L3.736 19.5H0.426L8.156 10.665L0 0H6.826L11.539 6.231L16.99 0ZM15.829 17.52H17.662L5.83 1.876H3.863L15.829 17.52Z" />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 127.14 96.36" fill="currentColor" className={className}>
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  )
}

const links = [
  {
    label: "Agio Network",
    href: "/",
    icon: Globe,
    description: "Decentralized Social Finance on Solana",
    external: false,
  },
  {
    label: "Docs",
    href: "/docs",
    icon: FileText,
    description: "Technical docs",
    external: false,
  },
  {
    label: "X (Twitter)",
    href: "https://x.com/agio_network",
    icon: XIcon,
    description: "Follow us",
    external: true,
    iconBg: "#000000",
  },
  {
    label: "Discord",
    href: "https://discord.com/invite/EmwdzjC2DM",
    icon: DiscordIcon,
    description: "Join us",
    external: true,
    iconBg: "#5865F2",
  },
  {
    label: "Telegram",
    href: "https://t.me/agio_network",
    icon: Send,
    description: "Community",
    external: true,
    iconBg: "#26A5E4",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/agio-network",
    icon: Linkedin,
    description: "Company",
    external: true,
    iconBg: "#0A66C2",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.15,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
}

export default function LinksPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center bg-gradient-to-b from-[#020a1a] via-[#071330] to-[#020a1a] overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#1358EC]/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#1358EC]/5 rounded-full blur-[150px] pointer-events-none" />

      <motion.div
        className="relative z-10 w-full max-w-3xl mx-auto px-6 py-16 md:py-24"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center text-center mb-14"
        >
          <div className="relative w-[100px] h-[100px] mb-6">
            <Image
              src="/agio-logo-3d.png"
              alt="Agio Network"
              width={100}
              height={100}
              className="object-contain drop-shadow-[0_0_30px_rgba(19,88,236,0.3)]"
              priority
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
            Agio Network
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-md leading-relaxed">
            Decentralized Social Finance for Borrowers &amp; Lenders.
          </p>
        </motion.div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-16 max-w-xl mx-auto">
          {links.map((link) => (
            <motion.div key={link.label} variants={itemVariants}>
              <Link
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="group flex flex-col items-center text-center p-5 md:p-6 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 hover:border-blue-500/40 hover:bg-slate-800/60 transition-all duration-300 hover:-translate-y-1 h-full"
              >
                <div
                  className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 mb-3 ${
                    link.iconBg
                      ? ""
                      : "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300"
                  }`}
                  style={link.iconBg ? { backgroundColor: link.iconBg, color: "#ffffff" } : undefined}
                >
                  <link.icon className="h-5 w-5" />
                </div>
                <span className="text-white font-medium text-sm mb-1">
                  {link.label}
                </span>
                <span className="text-slate-500 text-xs">
                  {link.description}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.div
          variants={itemVariants}
          className="text-center"
        >
          <p className="text-white text-xs">
            &copy; 2026 Agio Network. All rights reserved.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
