"use client"

import { motion } from "framer-motion"
import { Percent } from "lucide-react"
import { type ComponentType } from "react"

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7l-9-5z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

const BrainIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C9 2 7 4 7 6.5c0 .5.1 1 .2 1.5C5.3 8.5 4 10.2 4 12.2c0 1.5.7 2.9 1.8 3.8-.5.8-.8 1.8-.8 2.8C5 21 6.8 22 9 22c1.5 0 2.5-.5 3-1" />
    <path d="M12 2c3 0 5 2 5 4.5c0 .5-.1 1-.2 1.5C18.7 8.5 20 10.2 20 12.2c0 1.5-.7 2.9-1.8 3.8.5.8.8 1.8.8 2.8 0 2.2-1.8 3.2-4 3.2-1.5 0-2.5-.5-3-1" />
    <path d="M12 2v20" />
    <path d="M7.5 10c1.5 0 3 .5 4.5 2" />
    <path d="M16.5 10c-1.5 0-3 .5-4.5 2" />
    <path d="M7 16c1.5-.5 3.5-1 5-1" />
    <path d="M17 16c-1.5-.5-3.5-1-5-1" />
  </svg>
)

const features: { icon: ComponentType<{ className?: string }>; title: string; description: string }[] = [
  {
    icon: ShieldIcon,
    title: "Secure Lending",
    description: "Advanced security protocols ensure your assets are always protected"
  },
  {
    icon: Percent,
    title: "Competitive Rates",
    description: "Get the best rates for your loans and investments"
  },
  {
    icon: BrainIcon,
    title: "Smart Contracts",
    description: "Automated and transparent lending process"
  },
]

export function FeaturesSection() {

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
            Why Choose Agio Network?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Experience the next generation of DeFi with our innovative features
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="bg-white dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-gray-200/10 p-6 rounded-lg shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-500/20 rounded-full">
                  <feature.icon className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-black dark:text-white">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
} 