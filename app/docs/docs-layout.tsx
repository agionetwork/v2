"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect, type ComponentType } from "react"
import {
  BookOpen,
  Rocket,
  Compass,
  HandCoins,
  Banknote,
  EyeOff,
  UserCheck,
  Users,
  Repeat,
  Bot,
  Coins,
  Plug,
  ShieldAlert,
  HelpCircle,
  Library,
  Network,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LangProvider, useLang, LANGS, type Lang } from "./i18n"

const ICON_BY_HREF: Record<string, ComponentType<{ className?: string }>> = {
  "/docs": BookOpen,
  "/docs/getting-started": Rocket,
  "/docs/core-concepts": Compass,
  "/docs/lending": HandCoins,
  "/docs/borrowing": Banknote,
  "/docs/private-mode": EyeOff,
  "/docs/exclusive-counterparty": UserCheck,
  "/docs/social": Users,
  "/docs/lending-bot": Repeat,
  "/docs/agents": Bot,
  "/docs/agiosol": Coins,
  "/docs/mcp": Plug,
  "/docs/security": ShieldAlert,
  "/docs/faq": HelpCircle,
  "/docs/glossary": Library,
  "/docs/api": Network,
}

const NAV: Record<Lang, { title: string; items: { title: string; href: string }[] }[]> = {
  en: [
    { title: "Getting Started", items: [{ title: "Introduction", href: "/docs" }, { title: "Quick Start", href: "/docs/getting-started" }] },
    { title: "Core Concepts", items: [{ title: "How It Works?", href: "/docs/core-concepts" }, { title: "Lending", href: "/docs/lending" }, { title: "Borrowing", href: "/docs/borrowing" }] },
    { title: "Privacy", items: [{ title: "Private Mode", href: "/docs/private-mode" }, { title: "Exclusive Counterparty", href: "/docs/exclusive-counterparty" }] },
    { title: "Features", items: [{ title: "Social", href: "/docs/social" }, { title: "Auto Loan", href: "/docs/lending-bot" }, { title: "AI Agents", href: "/docs/agents" }] },
    { title: "Tokenomics", items: [{ title: "$agioSOL", href: "/docs/agiosol" }] },
    { title: "Developers", items: [{ title: "AI Integration", href: "/docs/mcp" }, { title: "Public API", href: "/docs/api" }, { title: "Security & Risk", href: "/docs/security" }] },
    { title: "Reference", items: [{ title: "FAQ", href: "/docs/faq" }, { title: "Glossary", href: "/docs/glossary" }] },
  ],
  es: [
    { title: "Inicio", items: [{ title: "Introducción", href: "/docs" }, { title: "Inicio Rápido", href: "/docs/getting-started" }] },
    { title: "Conceptos", items: [{ title: "¿Cómo Funciona?", href: "/docs/core-concepts" }, { title: "Préstamos", href: "/docs/lending" }, { title: "Solicitar Préstamo", href: "/docs/borrowing" }] },
    { title: "Privacidad", items: [{ title: "Modo Privado", href: "/docs/private-mode" }, { title: "Contraparte Exclusiva", href: "/docs/exclusive-counterparty" }] },
    { title: "Funciones", items: [{ title: "Social", href: "/docs/social" }, { title: "Auto Loan", href: "/docs/lending-bot" }, { title: "Agentes IA", href: "/docs/agents" }] },
    { title: "Tokenomics", items: [{ title: "$agioSOL", href: "/docs/agiosol" }] },
    { title: "Desarrolladores", items: [{ title: "Integración IA", href: "/docs/mcp" }, { title: "API Pública", href: "/docs/api" }, { title: "Seguridad y Riesgo", href: "/docs/security" }] },
    { title: "Referencia", items: [{ title: "FAQ", href: "/docs/faq" }, { title: "Glosario", href: "/docs/glossary" }] },
  ],
  pt: [
    { title: "Início", items: [{ title: "Introdução", href: "/docs" }, { title: "Início Rápido", href: "/docs/getting-started" }] },
    { title: "Conceitos", items: [{ title: "Como Funciona?", href: "/docs/core-concepts" }, { title: "Empréstimos", href: "/docs/lending" }, { title: "Solicitar Empréstimo", href: "/docs/borrowing" }] },
    { title: "Privacidade", items: [{ title: "Modo Privado", href: "/docs/private-mode" }, { title: "Contraparte Exclusiva", href: "/docs/exclusive-counterparty" }] },
    { title: "Recursos", items: [{ title: "Social", href: "/docs/social" }, { title: "Auto Loan", href: "/docs/lending-bot" }, { title: "Agentes IA", href: "/docs/agents" }] },
    { title: "Tokenomics", items: [{ title: "$agioSOL", href: "/docs/agiosol" }] },
    { title: "Desenvolvedores", items: [{ title: "Integração IA", href: "/docs/mcp" }, { title: "API Pública", href: "/docs/api" }, { title: "Segurança e Risco", href: "/docs/security" }] },
    { title: "Referência", items: [{ title: "FAQ", href: "/docs/faq" }, { title: "Glossário", href: "/docs/glossary" }] },
  ],
  zh: [
    { title: "开始", items: [{ title: "简介", href: "/docs" }, { title: "快速开始", href: "/docs/getting-started" }] },
    { title: "核心概念", items: [{ title: "工作原理？", href: "/docs/core-concepts" }, { title: "出借", href: "/docs/lending" }, { title: "借款", href: "/docs/borrowing" }] },
    { title: "隐私", items: [{ title: "私密模式", href: "/docs/private-mode" }, { title: "独家对手方", href: "/docs/exclusive-counterparty" }] },
    { title: "功能", items: [{ title: "社交", href: "/docs/social" }, { title: "Auto Loan", href: "/docs/lending-bot" }, { title: "AI 代理", href: "/docs/agents" }] },
    { title: "Tokenomics", items: [{ title: "$agioSOL", href: "/docs/agiosol" }] },
    { title: "开发者", items: [{ title: "AI 集成", href: "/docs/mcp" }, { title: "公开 API", href: "/docs/api" }, { title: "安全与风险", href: "/docs/security" }] },
    { title: "参考", items: [{ title: "FAQ", href: "/docs/faq" }, { title: "术语表", href: "/docs/glossary" }] },
  ],
}

const BOTTOM_LABELS: Record<Lang, { prev: string; next: string }> = {
  en: { prev: "Previous", next: "Next" },
  es: { prev: "Anterior", next: "Siguiente" },
  pt: { prev: "Anterior", next: "Próximo" },
  zh: { prev: "上一页", next: "下一页" },
}

function LangToggle() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGS.find((l) => l.code === lang)!

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <span>{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div
          className="border border-border bg-background rounded-md"
          style={{ position: "absolute", right: 0, top: "100%", marginTop: "0.25rem", minWidth: "10rem", zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false) }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted",
                l.code === lang ? "font-medium text-primary" : "text-muted-foreground"
              )}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DocsLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { lang } = useLang()
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = NAV[lang]
  const labels = BOTTOM_LABELS[lang]
  const flat = nav.flatMap((g) => g.items)
  const idx = flat.findIndex((i) => i.href === pathname)
  const prev = idx > 0 ? flat[idx - 1] : null
  const next = idx < flat.length - 1 ? flat[idx + 1] : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        .docs-header-hamburger { display: block; }
        .docs-sidebar { position: fixed; top: 3.5rem; bottom: 0; left: 0; z-index: 40; width: 16rem; overflow-y: auto; transform: translateX(-100%); transition: transform 0.2s; }
        .docs-sidebar.open { transform: translateX(0); }
        .docs-body { display: block; }
        .docs-body-content { padding: 2rem 1rem; }
        @media (min-width: 1024px) {
          .docs-header-hamburger { display: none; }
          .docs-body { display: grid; grid-template-columns: 260px 1fr; }
          .docs-body-content { padding: 3rem 4rem; }
          .docs-sidebar { position: sticky; top: 3.5rem; height: calc(100vh - 3.5rem); transform: translateX(0); z-index: 0; width: auto; }
        }
        .docs-content h1 { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.75rem; line-height: 1.2; }
        .docs-content h2 { font-size: 1.25rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.5rem; line-height: 1.3; }
        .docs-content h3 { font-size: 1.125rem; font-weight: 500; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .docs-content p { margin-bottom: 1rem; line-height: 1.75; }
        .docs-content .lead { font-size: 1.125rem; color: hsl(var(--muted-foreground)); margin-bottom: 1.5rem; }
        .docs-content ul, .docs-content ol { margin-bottom: 1rem; padding-left: 1.5rem; }
        .docs-content ul { list-style-type: disc; }
        .docs-content ol { list-style-type: decimal; }
        .docs-content li { margin-bottom: 0.25rem; line-height: 1.75; }
        .docs-content a { color: hsl(var(--primary)); text-decoration: none; }
        .docs-content a:hover { text-decoration: underline; }
        .docs-content code { background: hsl(var(--muted)); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875rem; }
        .docs-content pre { background: hsl(var(--muted)); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin-bottom: 1rem; }
        .docs-content pre code { background: none; padding: 0; }
        .docs-content table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .docs-content th { text-align: left; padding-bottom: 0.5rem; font-weight: 500; border-bottom: 1px solid hsl(var(--border)); }
        .docs-content td { padding: 0.5rem 0.5rem 0.5rem 0; }
        .docs-content strong { font-weight: 600; }
        .docs-content hr { border-color: hsl(var(--border)); margin: 2rem 0; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border/60 bg-background px-4" style={{ backdropFilter: "blur(8px)" }}>
        <button
          className="docs-header-hamburger -ml-1 mr-3 p-2 rounded-md hover:bg-muted"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>

        <a href="https://agio.network" className="flex items-center gap-2.5" target="_blank" rel="noopener noreferrer">
          <Image src="/agio-logo-3d.png" alt="Agio" width={32} height={32} className="object-contain" />
          <span className="font-display text-[15px] font-medium tracking-tight">Agio Network</span>
          <span className="text-muted-foreground text-xs font-normal">Docs</span>
        </a>

        <div style={{ flex: 1 }} />
        <LangToggle />
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setMobileOpen(false)} />
      )}

      {/* Body */}
      <div className="docs-body">
        <aside className={cn("docs-sidebar border-r border-border/60 bg-background", mobileOpen && "open")}>
          <nav style={{ padding: "1.25rem 1rem" }}>
            {nav.map((group) => (
              <div key={group.title} style={{ marginBottom: "1.25rem" }}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" style={{ marginBottom: "0.375rem" }}>
                  {group.title}
                </h4>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {group.items.map((item) => {
                    const Icon = ICON_BY_HREF[item.href]
                    return (
                      <li key={item.href} style={{ margin: 0 }}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                            pathname === item.href
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                          <span>{item.title}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="docs-body-content">
            <article className="docs-content" style={{ maxWidth: "48rem" }}>
              {children}
            </article>

            {(prev || next) && (
              <div className="flex items-center justify-between border-t border-border/60" style={{ maxWidth: "48rem", marginTop: "4rem", paddingTop: "1.5rem" }}>
                {prev ? (
                  <Link href={prev.href} className="group flex flex-col gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span className="text-xs uppercase tracking-wider">{labels.prev}</span>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">&larr; {prev.title}</span>
                  </Link>
                ) : <div />}
                {next ? (
                  <Link href={next.href} className="group flex flex-col items-end gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <span className="text-xs uppercase tracking-wider">{labels.next}</span>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">{next.title} &rarr;</span>
                  </Link>
                ) : <div />}
              </div>
            )}

          </div>
        </main>
      </div>

      <footer className="sticky bottom-0 z-40 border-t border-border/40 bg-background text-xs text-muted-foreground text-center py-3">
        &copy; {new Date().getFullYear()} Agio Network. All rights reserved.
      </footer>
    </div>
  )
}

export function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <DocsLayoutInner>{children}</DocsLayoutInner>
    </LangProvider>
  )
}
