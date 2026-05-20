"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";

export type ActionItem =
  | {
      label: string;
      icon?: LucideIcon;
      onClick: () => void;
      destructive?: boolean;
    }
  | "separator";

// ─── Right-click context menu ────────────────────────────────────────────────

interface ContextMenuProps {
  items: ActionItem[];
  children: (bind: { onContextMenu: React.MouseEventHandler }) => React.ReactNode;
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setPos(null), []);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
  }

  useEffect(() => {
    if (!pos) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pos, close]);

  // Push menu inside viewport after it renders
  useLayoutEffect(() => {
    if (!pos || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let { x, y } = pos;
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [pos]);

  return (
    <>
      {children({ onContextMenu: handleContextMenu })}
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999 }}
            className="min-w-[160px] rounded-xl border border-border bg-card p-1 shadow-lg"
          >
            {items.map((item, i) =>
              item === "separator" ? (
                <div key={i} className="my-1 h-px bg-border" />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    close();
                    item.onClick();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    item.destructive
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0" />}
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

// ─── ⋯ row action button ──────────────────────────────────────────────────────

interface RowMenuProps {
  items: ActionItem[];
}

export function RowMenu({ items }: RowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 outline-none transition-colors hover:bg-muted hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        {items.map((item, i) =>
          item === "separator" ? (
            <DropdownMenuSeparator key={i} />
          ) : (
            <DropdownMenuItem
              key={i}
              onClick={item.onClick}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs ${
                item.destructive ? "text-destructive focus:text-destructive" : "text-muted-foreground"
              }`}
            >
              {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0" />}
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
