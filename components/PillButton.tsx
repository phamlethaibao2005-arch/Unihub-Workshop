import * as React from "react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

type PillVariant = "primary" | "ghost" | "outline-image"

interface PillButtonProps extends React.ComponentProps<"button"> {
  variant?: PillVariant
  asChild?: boolean
}

const variantClass: Record<PillVariant, string> = {
  primary: "pill-primary",
  ghost: "pill-ghost",
  "outline-image": "pill-outline-image",
}

export function PillButton({
  variant = "primary",
  asChild = false,
  className,
  children,
  ...props
}: PillButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      className={cn(variantClass[variant], className)}
      {...props}
    >
      {children}
    </Comp>
  )
}
