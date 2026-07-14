import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@struxa/ui/lib/utils";
import * as React from "react";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background",
        secondary: "bg-muted text-muted-foreground",
        outline: "border border-border text-foreground",
        success:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        destructive: "bg-destructive/10 text-destructive",
        warning:
          "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
