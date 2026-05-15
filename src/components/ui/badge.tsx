import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "#/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-white shadow hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
        warning:
          "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
        muted: "border-muted-foreground/25 bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
