"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData, skipToken } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type AllocationResult = { id: string; ip: string; port: number; ipAlias?: string | null };

function formatAllocation(a: AllocationResult) {
  return a.ipAlias ? `${a.ipAlias} (${a.ip}:${a.port})` : `${a.ip}:${a.port}`;
}

export function AllocationCombobox({
  nodeId,
  value,
  onChange,
  initialAllocation,
  placeholder = "Search by IP or port…",
  disabledPlaceholder = "Select a node first",
  emptyText = "No free allocations found",
}: {
  nodeId: string;
  value: string;
  onChange: (id: string) => void;
  initialAllocation?: AllocationResult | null;
  placeholder?: string;
  disabledPlaceholder?: string;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AllocationResult | null>(initialAllocation ?? null);
  const ref = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query.trim(), 300);

  const { data: results = [], isFetching } = useQuery({
    ...orpc.allocations.search.queryOptions({ input: nodeId ? { nodeId, query: debouncedQuery } : skipToken }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  useEffect(() => {
    setSelected(initialAllocation ?? null);
  }, [initialAllocation?.id]);

  function select(a: AllocationResult) {
    onChange(a.id);
    setSelected(a);
    setQuery("");
    setOpen(false);
  }

  if (!nodeId) {
    return (
      <div className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground/50">
        {disabledPlaceholder}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      {selected && !open ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <span className="flex-1 truncate font-mono text-sm text-foreground">{formatAllocation(selected)}</span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSelected(null);
              setOpen(true);
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            change
          </button>
        </div>
      ) : (
        <input
          autoFocus={open}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      )}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {isFetching && debouncedQuery !== query.trim() ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">{emptyText}</div>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(a);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left font-mono text-sm text-foreground hover:bg-muted transition-colors"
              >
                {formatAllocation(a)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
