import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/** Plain status text with a small dot: no pill, no tinted background. */
const badgeVariants = cva("inline-flex items-center gap-1.5 text-xs font-medium before:size-1.5 before:rounded-full before:content-['']", {
  variants: {
    variant: {
      default: "text-foreground before:bg-foreground",
      secondary: "text-muted-foreground before:bg-muted-foreground/60",
      success: "text-foreground before:bg-emerald-600",
      warning: "text-foreground before:bg-amber-500",
      info: "text-foreground before:bg-sky-600",
      outline: "text-foreground before:bg-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
