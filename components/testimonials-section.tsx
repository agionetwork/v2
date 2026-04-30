"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "DeFi Investor",
    image: "/images/testimonials/sarah.jpg",
    quote: "Agio Network has revolutionized how I manage my DeFi investments. The platform is intuitive and secure."
  },
  {
    name: "Michael Chen",
    role: "Crypto Trader",
    image: "/images/testimonials/michael.jpg",
    quote: "The lending rates are competitive, and the platform's security gives me peace of mind."
  },
  {
    name: "Emma Rodriguez",
    role: "Blockchain Developer",
    image: "/images/testimonials/emma.jpg",
    quote: "As a developer, I appreciate the transparency and efficiency of Agio's smart contracts."
  }
]

// Duplicate for seamless infinite loop
const duplicated = [...testimonials, ...testimonials]

export function TestimonialsSection() {
  const [paused, setPaused] = useState(false)

  return (
    <section className="w-full py-20 md:py-32">
      <div className="container px-4 md:px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-4 text-black dark:text-white">
            What Our Users Say
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Join lots of users who trust Agio Network for their DeFi needs
          </p>
        </motion.div>
      </div>

      <div
        className="w-full overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="flex gap-8"
          style={{
            animation: 'scroll-left 20s linear infinite',
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {duplicated.map((testimonial, index) => (
            <div
              key={`${testimonial.name}-${index}`}
              className="bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-gray-200/10 p-6 rounded-lg shadow-lg w-[350px] flex-shrink-0"
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-black dark:text-white">{testimonial.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{testimonial.role}</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-300">{testimonial.quote}</p>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  )
}
