import type { Metadata } from "next"
import DashboardPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Monitor your lending positions, agent status, and portfolio performance.",
}

export default function DashboardPage() {
  return <DashboardPageClient />
}
