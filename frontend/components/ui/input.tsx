import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Kobie dark input — ocean bg, coral focus ring
        "flex h-9 w-full rounded-[6px] border border-white/12 bg-white/06 px-3 py-2",
        "font-[var(--kobie-font-body)] text-sm text-white placeholder:text-white/30",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[#fd7f4f]/40 focus:border-[#fd7f4f]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "file:text-white file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Input }
