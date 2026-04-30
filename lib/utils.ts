import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value)
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(later, wait)
  }
}

/**
 * Retorna a classe CSS para a cor de badge baseada na pontuação de reputação
 * 
 * @param score Pontuação de reputação (0-100)
 * @returns String de classe CSS para o badge
 */
export function getReputationColor(score: number) {
  if (score >= 80) return "bg-green-500 text-white" // Verde (80-100): Excelente reputação
  if (score >= 50) return "bg-yellow-500 text-white" // Amarelo (50-79): Boa reputação
  if (score >= 25) return "bg-orange-500 text-white" // Laranja (25-49): Reputação mediana
  return "bg-red-500 text-white" // Vermelho (0-24): Reputação baixa
}
