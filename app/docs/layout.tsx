import type { Metadata } from "next"
import { DocsLayout } from "./docs-layout"

export const metadata: Metadata = {
  title: {
    default: "Documentation",
    template: "%s | Agio Network Docs",
  },
  description: "Agio Network documentation — learn how to lend, borrow, and earn on Solana.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout>{children}</DocsLayout>
}
