import type { Metadata } from "next"
import BorrowLendPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Borrow & Lend",
  description: "Create and manage peer-to-peer loan offers on Solana.",
}

export default function BorrowLendPage() {
  return <BorrowLendPageClient />
}
