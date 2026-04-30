import type { Metadata } from "next"
import { Suspense } from "react"
import LoanOffersPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Loan Offers",
  description: "Browse and accept open lending and borrowing offers.",
}

export default function LoanOffersPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    }>
      <LoanOffersPageClient />
    </Suspense>
  )
}
