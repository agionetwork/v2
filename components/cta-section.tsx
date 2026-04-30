"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

export function CTASection() {

  return (
    <section className="w-full py-20 md:py-32">
      <div className="container px-4 md:px-6">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-4 text-black dark:text-white">
            Ready to Start Your DeFi Journey?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
            Join thousands of users who are already benefiting from our innovative lending platform.
            Sign up now and be part of the future of decentralized finance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                Launch App
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="https://agio-network.gitbook.io/agio-network" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="bg-white hover:bg-gray-100 text-blue-600 hover:text-blue-600 border-blue-600 font-bold">
                Learn More
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}