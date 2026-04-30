import { memo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FormFieldProps {
  label: string
  name: string
  type?: string
  value: string | number
  onChange: (value: string) => void
  error?: string
  tooltip?: string
  min?: string | number
  max?: string | number
  step?: string | number
  disabled?: boolean
}

function FormFieldComponent({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  tooltip,
  min,
  max,
  step,
  disabled = false,
}: FormFieldProps) {
  const field = (
    <div className="space-y-2">
      <Label
        htmlFor={name}
        className="text-sm font-medium text-gray-700"
      >
        {label}
      </Label>
      <Input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? "border-red-500" : ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {field}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return field
}

export const FormField = memo(FormFieldComponent) 