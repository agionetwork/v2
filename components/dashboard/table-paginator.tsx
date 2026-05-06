"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ParsedLoan } from "@/hooks/useLoans"

/**
 * Stable, deterministic sort for loan tables. Newest accepted loans
 * surface first (start desc); ties (incl. all pending offers, where
 * start=0) fall back to publicKey so the rows never shuffle between
 * polls or refreshes.
 */
export function sortLoansStable(loans: ParsedLoan[]): ParsedLoan[] {
  return [...loans].sort((a, b) => {
    const startDiff = (b.start || 0) - (a.start || 0)
    if (startDiff !== 0) return startDiff
    return a.publicKey.localeCompare(b.publicKey)
  })
}

export const TABLE_PAGE_SIZE = 10

interface PaginatorProps {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

export function TablePaginator({ page, totalPages, onChange }: PaginatorProps) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
