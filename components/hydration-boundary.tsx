"use client"

import { useEffect, useState, ReactNode } from "react"

interface HydrationBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Um componente de fronteira para evitar erros de hidratação
 * Renderiza seu conteúdo apenas no lado do cliente após a hidratação
 * 
 * @param children Conteúdo a ser renderizado após hidratação
 * @param fallback Conteúdo opcional para exibir antes da hidratação (esqueleto)
 */
export function HydrationBoundary({ children, fallback }: HydrationBoundaryProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Add a small delay to ensure all components are ready
    const timer = setTimeout(() => {
      setMounted(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  if (!mounted) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <>{children}</>
} 