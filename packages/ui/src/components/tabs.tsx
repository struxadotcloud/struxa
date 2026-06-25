"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@struxa/ui/lib/utils";
import * as React from "react";

type TabsVariant = "default" | "underline";

const TabsVariantContext = React.createContext<TabsVariant>("default");

const Tabs = TabsPrimitive.Root;

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & { variant?: TabsVariant }) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        className={cn(
          "flex items-center",
          variant === "default" && "gap-1 rounded-xl bg-muted p-1",
          variant === "underline" && "gap-0",
          className,
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  );
}

function TabsTab({
  className,
  ...props
}: TabsPrimitive.Tab.Props) {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        variant === "default" && [
          "rounded-lg px-3 py-1.5 text-muted-foreground",
          "data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm",
        ],
        variant === "underline" && [
          "-mb-px border-b-2 border-transparent px-4 py-2 text-muted-foreground",
          "data-[active]:border-foreground data-[active]:text-foreground",
          "hover:text-foreground",
        ],
        className,
      )}
      {...props}
    />
  );
}

function TabsPanel({
  className,
  ...props
}: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTab, TabsPanel };
