"use client";

import type React from "react";
import { useTranslations } from "next-intl";
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
  confirmLabel,
  onConfirm,
  loading = false,
  destructive = false,
}: ConfirmDialogProps) {
  const t = useTranslations("common");

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
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            disabled={loading}
          >
            {t("cancel")}
          </DialogClose>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50 ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:opacity-80"
                : "bg-foreground text-background hover:opacity-80"
            }`}
          >
            {loading ? "…" : (confirmLabel ?? t("confirm"))}
          </button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
