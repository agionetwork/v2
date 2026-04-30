import { cn } from "@/lib/utils"
import { Icons } from "@/components/ui/icons"

interface FeedbackProps {
  type: "success" | "error" | "info" | null
  message: string | null
  className?: string
}

export function Feedback({ type, message, className }: FeedbackProps) {
  if (!type || !message) return null

  const styles = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-blue-50 text-blue-800 border-blue-200"
  }

  const icons = {
    success: Icons.checkCircle,
    error: Icons.alertCircle,
    info: Icons.info
  }

  const Icon = icons[type]

  return (
    <div className={cn(
      "flex items-center gap-2 p-3 rounded-lg border",
      styles[type],
      className
    )}>
      <Icon className="h-5 w-5" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
} 