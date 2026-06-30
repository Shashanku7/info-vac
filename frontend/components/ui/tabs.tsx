"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  // Kobie: dark ocean pill container
  "group/tabs-list inline-flex w-fit items-center justify-center p-[3px] text-white/50 group-data-horizontal/tabs:h-9 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-white/06 border border-white/10 rounded-lg",
        line: "gap-1 bg-transparent border-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Kobie: dark tab — coral active, white/50 inactive
        "relative inline-flex h-[calc(100%-2px)] flex-1 items-center justify-center gap-1.5 rounded-[5px] px-3 py-1",
        "text-xs font-semibold font-[var(--kobie-font-heading)] whitespace-nowrap",
        "text-white/50 transition-all duration-200",
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
        "hover:text-white/80",
        "focus-visible:outline-2 focus-visible:outline-[#fd7f4f]",
        "disabled:pointer-events-none disabled:opacity-40",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        // Active state: ocean bg + coral text
        "data-active:bg-[#092538] data-active:text-[#fd7f4f] data-active:shadow-md data-active:shadow-black/30",
        // Line variant: coral underline
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "after:absolute after:bg-[#fd7f4f] after:opacity-0 after:transition-opacity",
        "group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5",
        "group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
