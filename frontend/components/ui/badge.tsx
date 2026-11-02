import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        outline: "text-foreground",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/15 text-yellow-700",
        info: "border-transparent bg-primary/10 text-primary",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Maps an ERP status string to a sensible badge variant. */
export function statusVariant(s: string): VariantProps<typeof badgeVariants>["variant"] {
  const good = ["BULLISH", "APPROVED", "CEO_APPROVED", "EXECUTED", "REPAID", "COMPLETED", "ACKNOWLEDGED", "CTO_VERIFIED", "CLOSED", "PAID", "VALID"];
  const warn = ["STABLE", "PROPOSED", "SUBMITTED", "SCHEDULED", "DISPATCHED", "FLAGGED_COMPLETE", "PM_VERIFIED", "MAJOR", "HIGH", "CLIENT_REVIEW", "CTO_AUDIT", "IN_PROGRESS", "ACTIVE"];
  const bad = ["BANKRUPT_RISK", "REJECTED", "DEFAULTED", "DISPUTED", "CRITICAL"];
  if (good.includes(s)) return "success";
  if (warn.includes(s)) return "warning";
  if (bad.includes(s)) return "destructive";
  return "muted";
}

export { Badge, badgeVariants };
