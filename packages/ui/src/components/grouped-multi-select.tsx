"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, SearchIcon, CheckIcon } from "lucide-react";
import { cn } from "@struxa/ui/lib/utils";

export interface GroupedMultiSelectItem {
  id: string;
  label: string;
}

export interface GroupedMultiSelectGroup {
  id: string;
  label: string;
  items: GroupedMultiSelectItem[];
}

export function GroupedMultiSelect({
  value,
  onChange,
  groups,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className,
}: {
  value: string[];
  onChange: (values: string[]) => void;
  groups: GroupedMultiSelectGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  function openDropdown() {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!open) return;
    function handleScroll(e: Event) {
      if (popupRef.current?.contains(e.target as Node)) return;
      close();
    }
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) => item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  function toggleGroup(group: GroupedMultiSelectGroup) {
    const ids = group.items.map((i) => i.id);
    const allChecked = ids.every((id) => value.includes(id));
    onChange(allChecked ? value.filter((v) => !ids.includes(v)) : [...new Set([...value, ...ids])]);
  }

  const selectedLabels = value
    .map((id) => allItems.find((i) => i.id === id)?.label)
    .filter(Boolean) as string[];

  const triggerText = selectedLabels.length === 0
    ? null
    : selectedLabels.length <= 3
      ? selectedLabels.join(", ")
      : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2} more`;

  const dropdown = open && rect
    ? createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={close} />
          <div
            ref={popupRef}
            className="fixed z-[201] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
          >
            <div className="border-b border-border px-2 py-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
                <SearchIcon className="size-3 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No results</p>
              ) : (
                filtered.map((group) => {
                  const groupChecked = group.items.every((i) => value.includes(i.id));
                  return (
                    <div key={group.id}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60"
                      >
                        <div className={cn(
                          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                          groupChecked ? "border-primary bg-primary" : "border-border bg-background",
                        )}>
                          {groupChecked && <CheckIcon className="size-2.5 text-primary-foreground" />}
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </span>
                      </button>
                      {group.items.map((item) => {
                        const checked = value.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggle(item.id)}
                            className="flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 pl-6 text-left hover:bg-muted/60"
                          >
                            <div className={cn(
                              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                              checked ? "border-primary bg-primary" : "border-border bg-background",
                            )}>
                              {checked && <CheckIcon className="size-2.5 text-primary-foreground" />}
                            </div>
                            <span className="text-xs text-foreground">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {value.length > 0 && (
              <div className="border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Clear all ({value.length})
                </button>
              </div>
            )}
          </div>
        </>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/40",
          open && "border-ring ring-2 ring-ring",
          className,
        )}
      >
        <span className="truncate text-left">
          {triggerText ?? <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        <ChevronDownIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {dropdown}
    </>
  );
}
