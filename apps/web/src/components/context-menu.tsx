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
            className="min-w-[160px] border border-[#2a2a2a] bg-[#0d0d0d] py-1 shadow-2xl"
          >
            {items.map((item, i) =>
              item === "separator" ? (
                <div key={i} className="my-1 h-px bg-[#1e1e1e]" />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    close();
                    item.onClick();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-[#181818] ${
                    item.destructive
                      ? "text-[#f43f5e] hover:text-[#f43f5e]"
                      : "text-[#888888] hover:text-white"
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
        className="flex h-6 w-6 items-center justify-center text-[#444444] outline-none transition-colors hover:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl"
      >
        {items.map((item, i) =>
          item === "separator" ? (
            <DropdownMenuSeparator key={i} className="my-1 bg-[#1e1e1e]" />
          ) : (
            <DropdownMenuItem
              key={i}
              onClick={item.onClick}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs focus:bg-[#1a1a1a] ${
                item.destructive ? "text-[#f43f5e] focus:text-[#f43f5e]" : "text-[#888888] focus:text-white"
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
