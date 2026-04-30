"use client"

import { motion } from "framer-motion"

export function PageHeaderSpace() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="h-16 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    />
  )
} 