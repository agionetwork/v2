"use client"

import { ThemeProvider } from "next-themes"
import { Header } from "@/components/header"
import Footer from "@/components/footer"
import { Toaster } from "@/components/ui/toaster"
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isHomepage = pathname === '/'
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="agio-theme"
    >
      <div className={`flex min-h-screen flex-col relative z-10 ${
        mounted ? 'bg-gradient-to-b from-white to-blue-50 dark:from-gray-900 dark:to-gray-950' : ''
      } transition-colors duration-300`}>
        <Header />
        <main className="flex-1">{children}</main>
        {!isHomepage && <Footer />}
      </div>
      <Toaster />
    </ThemeProvider>
  )
} 