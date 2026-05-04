import type { Metadata } from "next"
import CompliancePageClient from "./page-client"

export const metadata: Metadata = {
  title: "Privacy & Audit",
  description:
    "Manage your stealth wallets, generate viewing keys for auditors, and disclose private loans without giving up spend authority.",
}

export default function CompliancePage() {
  return <CompliancePageClient />
}
