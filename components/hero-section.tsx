"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Settings, Bot, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export function HeroSection() {

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center py-20 md:py-32 text-foreground overflow-hidden">
      <div className="container px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center space-y-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <span className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-950 to-blue-900 text-blue-300 text-sm font-semibold tracking-wide uppercase border border-blue-800">
              <Radio className="h-4 w-4 text-red-400" />
              Devnet Live
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600">
                Reliable Loans
              </span>{" "}
              <span className="text-black dark:text-white">
                like a friendly handshake
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-[700px] mx-auto">
              Agio is the Social Network to connect Borrowers and Lenders.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="bg-[#1358EC] hover:bg-blue-700 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center" asChild>
              <Link href="/borrow-lend" className="flex items-center">
                TRY BETA
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white hover:bg-gray-100 text-blue-600 hover:text-blue-600 border-blue-600 font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105" asChild>
              <Link href="/loan-offers">
                LOAN OFFERS
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl"
          >
            <motion.div 
              className="flex items-center space-x-4 p-6 rounded-xl bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-gray-200/10 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-3 bg-blue-500/20 rounded-full">
                <svg className="h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 17.5L7.5 14l-3-3 4.5-4.5 2 2c.5.5 1.5.5 2 0l3-3 2 2-4 4" />
                  <path d="M13 17.5l3.5-3.5 4-4-4.5-4.5-2 2" />
                  <path d="M2.5 8.5L7 4" />
                  <path d="M17 4l4.5 4.5" />
                  <path d="M7.5 14l2.5 2.5" />
                  <path d="M11 17.5l2 2" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-black dark:text-white">P2P Lending</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Loans without middleman</p>
              </div>
            </motion.div>
            <motion.div 
              className="flex items-center space-x-4 p-6 rounded-xl bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-gray-200/10 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Settings className="h-6 w-6 text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-black dark:text-white">Customizable Agreement</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Period, Interest and Collateral</p>
              </div>
            </motion.div>
            <motion.div
              className="flex items-center space-x-4 p-6 rounded-xl bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-gray-200/10 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Bot className="h-6 w-6 text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-black dark:text-white">Agent Friendly</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Automate your lending strategy</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

