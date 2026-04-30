"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type Lang = "en" | "es" | "pt" | "zh"

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
]

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "en",
  setLang: () => {},
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")

  useEffect(() => {
    const saved = localStorage.getItem("docs-lang") as Lang | null
    if (saved && LANGS.some((l) => l.code === saved)) setLangState(saved)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem("docs-lang", l)
  }

  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>
}

export function useLang() {
  return useContext(LangCtx)
}

// Helper: pick translation by current lang
export function useT<T>(translations: Record<Lang, T>): T {
  const { lang } = useLang()
  return translations[lang]
}
