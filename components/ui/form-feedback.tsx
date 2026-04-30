import { Icons } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const feedbackVariants = cva(
  "flex items-center gap-2 rounded-md p-3 text-sm",
  {
    variants: {
      variant: {
        success: "bg-green-100 text-green-800 border border-green-200",
        error: "bg-red-100 text-red-800 border border-red-200",
        warning: "bg-yellow-100 text-yellow-800 border border-yellow-200",
        info: "bg-blue-100 text-blue-800 border border-blue-200",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

interface FormFeedbackProps extends VariantProps<typeof feedbackVariants> {
  message: string
  className?: string
  showIcon?: boolean
}

export function FormFeedback({
  message,
  variant,
  className,
  showIcon = true,
}: FormFeedbackProps) {
  return (
    <div className={cn(feedbackVariants({ variant }), className)}>
      {showIcon && variant === "success" && (
        <Icons.spinner className="h-4 w-4 animate-spin" />
      )}
      <span>{message}</span>
    </div>
  )
} 