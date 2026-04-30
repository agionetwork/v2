"use client"

import { Header } from "@/components/header"
import { HeroSection } from "@/components/landing/hero-section"
import { HowItWorks } from "@/components/landing/how-it-works"
import { PillarsSection } from "@/components/landing/pillars-section"
import { StatsSection } from "@/components/landing/stats-section"
import { EcosystemCarousel } from "@/components/landing/ecosystem-carousel"
import { CTASection } from "@/components/landing/cta-section"
import Footer from "@/components/footer"

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-[#0A1230] font-sans text-white">
      <Header />
      <HeroSection />
      <HowItWorks />
      <PillarsSection />
      <StatsSection />
      <EcosystemCarousel />
      <CTASection />
      <Footer />
    </main>
  )
}
