import type { Metadata } from "next"
import AutoLoanPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Auto-Loan",
  description:
    "Configure and run an autonomous lending bot that posts and accepts offers on your behalf based on the rules you set.",
}

export default function AutoLoanPage() {
  return <AutoLoanPageClient />
}
