"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@struxa/ui/lib/utils";

function Switch({
  className,
  ...props
}: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        "bg-input data-[checked]:bg-foreground",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block h-4 w-4 translate-x-0 rounded-full bg-background shadow-sm ring-0 transition-transform group-data-[checked]/switch:translate-x-4"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
