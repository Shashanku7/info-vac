import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-[8px] border px-3 py-2.5 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Kobie default: ocean card bg
        default:
          "bg-[#092538] border-white/12 text-white",
        // Coral info alert
        info:
          "bg-[#fd7f4f]/10 border-[#fd7f4f]/30 text-[#fd7f4f] *:data-[slot=alert-description]:text-[#fd7f4f]/80",
        // Destructive: red
        destructive:
          "bg-red-500/10 border-red-500/30 text-red-400 *:data-[slot=alert-description]:text-red-400/80 *:[svg]:text-current",
        // Success: green
        success:
          "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 *:data-[slot=alert-description]:text-emerald-400/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-semibold font-[var(--kobie-font-heading)] text-sm group-has-[>svg]/alert:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-xs text-balance text-white/60 group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-3",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
