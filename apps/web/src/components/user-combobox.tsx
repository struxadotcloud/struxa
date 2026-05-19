"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function UserCombobox({
  value,
  onChange,
  initialLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  initialLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query.trim(), 300);

  const { data: results = [], isFetching } = useQuery({
    ...orpc.users.search.queryOptions({ input: { query: debouncedQuery } }),
    enabled: debouncedQuery.length > 0,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (initialLabel && value && !selectedLabel) setSelectedLabel(initialLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLabel, value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      setQuery("");
    }
  }, [value]);

  function select(u: { id: string; name: string; email: string }) {
    onChange(u.id);
    setSelectedLabel(`${u.name} (${u.email})`);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {selectedLabel && !open ? (
        <div className="flex items-center gap-2 border border-[#333333] bg-[#141414] px-3 py-2">
          <span className="flex-1 text-sm text-white">{selectedLabel}</span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSelectedLabel("");
              setOpen(true);
            }}
            className="text-[10px] text-[#555555] hover:text-white"
          >
            change
          </button>
        </div>
      ) : (
        <input
          autoFocus={open}
          className="w-full border border-[#333333] bg-[#141414] px-3 py-2 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      )}
      {open && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 border border-[#333333] bg-[#0d0d0d]">
          {isFetching && debouncedQuery !== query.trim() ? (
            <div className="px-3 py-2 text-xs text-[#555555]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#555555]">
              {debouncedQuery.length > 0 ? "No users found" : "Type to search…"}
            </div>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(u);
                }}
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-[#1a1a1a]"
              >
                <span className="text-sm text-white">{u.name}</span>
                <span className="text-xs text-[#555555]">{u.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
