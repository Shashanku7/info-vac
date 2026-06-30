import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-[var(--kobie-font-heading)] w-fit whitespace-nowrap shrink-0 transition-colors",
  {
    variants: {
      variant: {
        // Coral — primary accent
        default:
          "border-[#fd7f4f]/40 bg-[#fd7f4f]/12 text-[#fd7f4f]",
        // Lavender — secondary
        secondary:
          "border-[#5461c9]/40 bg-[#5461c9]/12 text-[#8b96e0]",
        // Success green
        outline:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        // Destructive red
        destructive:
          "border-red-500/30 bg-red-500/10 text-red-400",
        // Neutral white/muted
        muted:
          "border-white/15 bg-white/06 text-white/55",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
