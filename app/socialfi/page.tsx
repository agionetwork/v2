import type { Metadata } from "next"
import SocialFiPageClient from "./page-client"

export const metadata: Metadata = {
  title: "SocialFi",
  description: "Connect with borrowers and lenders. View profiles, follow traders, and track activity.",
}

export default function SocialFiPage() {
  return <SocialFiPageClient />
}
