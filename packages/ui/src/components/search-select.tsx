"use client";

import { useState, useMemo } from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "@struxa/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";

export interface SearchSelectItem {
  value: string;
  label: string;
}

export function SearchSelect({
  value,
  onValueChange,
  items,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className,
}: {
  value: string;
  onValueChange: (v: string | null) => void;
  items: SearchSelectItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      query.trim()
        ? items.filter(
            (item) =>
              item.value.toLowerCase().includes(query.toLowerCase()) ||
              item.label.toLowerCase().includes(query.toLowerCase()),
          )
        : items,
    [items, query],
  );

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:border-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          className="isolate z-50 outline-none"
          align="start"
          sideOffset={4}
        >
          <SelectPrimitive.Popup className="z-50 w-72 origin-(--transform-origin) overflow-hidden rounded-xl border border-border bg-card shadow-lg duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="border-b border-border px-2 py-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
                <SearchIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No results
                </p>
              ) : (
                filtered.map((item) => (
                  <SelectPrimitive.Item
                    key={item.value}
                    value={item.value}
                    className="relative flex cursor-default items-center gap-2 rounded-lg py-1.5 pr-8 pl-2 text-xs outline-none select-none focus:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <span className="pointer-events-none absolute right-2 flex items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <CheckIcon className="h-3.5 w-3.5" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>
                      <span className="font-mono font-medium">{item.value}</span>
                    </SelectPrimitive.ItemText>
                    <span className="truncate text-muted-foreground">{item.label}</span>
                  </SelectPrimitive.Item>
                ))
              )}
            </div>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
