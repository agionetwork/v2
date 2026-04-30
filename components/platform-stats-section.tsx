import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

const stats = [
  {
    value: "10K+",
    label: "Active Users",
    description: "Growing community of borrowers and lenders"
  },
  {
    value: "$50M+",
    label: "Total Value Locked",
    description: "Secure and growing liquidity pool"
  },
  {
    value: "99.9%",
    label: "Uptime",
    description: "Reliable and consistent service"
  }
]

export function PlatformStatsSection() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true) }, []);
  if (!mounted) return null;

  const textMain = theme === 'dark' ? 'text-white' : 'text-black';
  const textSub = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
  const cardBg = theme === 'dark' ? 'bg-white/5' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-gray-200/10' : 'border-gray-200';

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
          <h2 className={`text-3xl md:text-4xl font-bold tracking-tighter mb-4 ${textMain}`}>
            Platform Statistics
          </h2>
          <p className={`${textSub} max-w-2xl mx-auto`}>
            Real-time metrics showing our platform&apos;s growth and performance
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className={`${cardBg} backdrop-blur-sm border ${cardBorder} p-6 rounded-lg shadow-lg`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="text-center">
                <h3 className={`text-3xl font-bold mb-2 ${textMain}`}>{stat.value}</h3>
                <p className={`font-semibold mb-2 ${textMain}`}>{stat.label}</p>
                <p className={`${textSub} text-sm`}>{stat.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
} 