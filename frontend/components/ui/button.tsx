import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base — Kobie geometric sharp style
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-[var(--kobie-font-heading)] text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 cursor-pointer select-none",
  {
    variants: {
      variant: {
        // Coral border, fills on hover — Kobie primary
        default:
          "bg-transparent text-white border-2 border-[#fd7f4f] rounded-[3px] hover:bg-[#fd7f4f] hover:text-white focus-visible:ring-2 focus-visible:ring-[#fd7f4f]/50",
        // Coral fill — solid primary
        primary:
          "bg-[#fd7f4f] text-white border-2 border-[#fd7f4f] rounded-[3px] hover:bg-[#f56d38] hover:border-[#f56d38] focus-visible:ring-2 focus-visible:ring-[#fd7f4f]/50",
        // Lavender fill
        secondary:
          "bg-[#5461c9] text-white border-2 border-[#5461c9] rounded-[3px] hover:bg-[#4451b5] focus-visible:ring-2 focus-visible:ring-[#5461c9]/50",
        // Subtle ocean ghost
        ghost:
          "bg-transparent text-white/65 border border-white/10 rounded-[6px] hover:bg-white/08 hover:text-white hover:border-white/20",
        // White border outline
        outline:
          "bg-transparent text-white/70 border border-white/20 rounded-[6px] hover:bg-white/06 hover:text-white hover:border-white/30",
        // Danger
        destructive:
          "bg-transparent text-red-400 border-2 border-red-500/60 rounded-[3px] hover:bg-red-500/15",
        // No decoration — for icon buttons
        link:
          "text-[#fd7f4f] underline-offset-4 hover:underline bg-transparent border-none",
      },
      size: {
        default: "h-9 px-5 py-2 text-sm",
        sm: "h-7 px-3 py-1.5 text-xs",
        lg: "h-11 px-7 py-2.5 text-base",
        icon: "h-8 w-8 p-0 rounded-[6px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
