"use client";

import type * as React from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@struxa/ui/components/button";
import { Input } from "@struxa/ui/components/input";
import { Label } from "@struxa/ui/components/label";

import AuthShell from "@/components/auth-shell";
import { authClient } from "@/lib/auth-client";

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1 text-xs text-destructive">
      <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 3.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
      </svg>
      {children}
    </p>
  );
}

export default function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  const passwordError = password.length >= 8 ? null : t("passwordMinLength");
  const confirmError = password === confirm ? null : t("passwordsNoMatch");
  const showPasswordError = Boolean(passwordError && (hasSubmitted || touchedPassword));
  const showConfirmError = Boolean(confirmError && (hasSubmitted || touchedConfirm));
  const isDisabled = Boolean(isSubmitting);

  if (!token) {
    return (
      <AuthShell title={t("title")} subtitle={t("subtitle")}>
        <div className="flex flex-col gap-3 text-center">
          <FieldError>{t("invalidToken")}</FieldError>
          <a
            className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
            href="/forgot-password"
          >
            {t("backToLogin")}
          </a>
        </div>
      </AuthShell>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setError(null);
    if (passwordError || confirmError) return;
    setIsSubmitting(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setIsSubmitting(false);
    if (resetError) {
      setError(resetError.message ?? t("resetFailed"));
      return;
    }
    router.push("/login");
  };

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <Input
            aria-invalid={showPasswordError || undefined}
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => setTouchedPassword(true)}
            placeholder={t("passwordPlaceholder")}
            type="password"
            value={password}
          />
          {showPasswordError ? <FieldError>{passwordError}</FieldError> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">{t("confirmLabel")}</Label>
          <Input
            aria-invalid={showConfirmError || undefined}
            id="confirm"
            name="confirm"
            onChange={(event) => setConfirm(event.target.value)}
            onBlur={() => setTouchedConfirm(true)}
            placeholder={t("confirmPlaceholder")}
            type="password"
            value={confirm}
          />
          {showConfirmError ? <FieldError>{confirmError}</FieldError> : null}
        </div>
        <Button className="w-full" type="submit" disabled={isDisabled}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
        {error ? <FieldError>{error}</FieldError> : null}
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <a
          className="font-medium text-foreground transition-colors hover:text-foreground/80"
          href="/login"
        >
          {t("backToLogin")}
        </a>
      </p>
    </AuthShell>
  );
}
