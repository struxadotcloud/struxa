"use client";

import type React from "react";
import {
  Dialog,
  DialogPopup,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@struxa/ui/components/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  onConfirm,
  loading = false,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children && <div className="px-5 py-3">{children}</div>}
        <DialogFooter>
          <DialogClose
            className="px-4 py-1.5 text-xs font-medium text-[#888888] transition-colors hover:text-white"
            disabled={loading}
          >
            Cancel
          </DialogClose>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50 ${
              destructive ? "bg-[#f43f5e]" : "bg-white text-black"
            }`}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
