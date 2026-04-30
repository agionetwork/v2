import type { Metadata } from "next"
import LeaderboardPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top lenders and borrowers ranked by activity and performance.",
}

export default function LeaderboardPage() {
  return <LeaderboardPageClient />
}
