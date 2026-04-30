"use client"

import { usePathname } from "next/navigation"

export function PageHeaderSpace() {
  const pathname = usePathname()
  
  // Não adiciona espaço na homepage
  if (pathname === "/") return null
  
  return <div className="h-20" /> // Espaço de 5rem (80px) após o header
} 