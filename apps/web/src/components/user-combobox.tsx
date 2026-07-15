"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { DitherAvatar } from "@struxa/ui/components/dither-kit/avatar";

function UserAvatar({ name, email, image, className }: { name: string; email: string; image?: string | null; className?: string }) {
  return (
    <div className={`shrink-0 overflow-hidden rounded-full bg-muted ${className ?? ""}`}>
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <DitherAvatar name={name || email} className="h-full w-full" />
      )}
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type UserResult = { id: string; name: string; email: string; image?: string | null };

export function UserCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query.trim(), 300);

  const { data: results = [], isFetching } = useQuery({
    ...orpc.users.search.queryOptions({ input: { query: debouncedQuery } }),
    enabled: debouncedQuery.length > 0,
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
    if (!value) {
      setSelectedUser(null);
      setQuery("");
    }
  }, [value]);

  function select(u: UserResult) {
    onChange(u.id);
    setSelectedUser(u);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {selectedUser && !open ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <UserAvatar name={selectedUser.name} email={selectedUser.email} image={selectedUser.image} className="h-6 w-6" />
          <span className="flex-1 truncate text-sm text-foreground">
            {selectedUser.name} <span className="text-muted-foreground">({selectedUser.email})</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSelectedUser(null);
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
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
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
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          {isFetching && debouncedQuery !== query.trim() ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">
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
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted transition-colors"
              >
                <UserAvatar name={u.name} email={u.email} image={u.image} className="h-7 w-7" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-medium text-foreground">{u.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
