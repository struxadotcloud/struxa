"use client";

import type * as React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@struxa/ui/components/button";
import { Input } from "@struxa/ui/components/input";
import { Label } from "@struxa/ui/components/label";

import AuthShell from "@/components/auth-shell";
import { authClient } from "@/lib/auth-client";

const emailPattern = /\S+@\S+\.\S+/;

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

export default function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);

  const normalizedEmail = email.trim();
  const emailError = !normalizedEmail
    ? t("emailRequired")
    : emailPattern.test(normalizedEmail)
      ? null
      : t("emailInvalid");
  const showEmailError = Boolean(emailError && (hasSubmitted || touchedEmail));
  const isDisabled = Boolean(isSubmitting);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setError(null);
    if (emailError) return;
    setIsSubmitting(true);
    const { error: reqError } = await authClient.requestPasswordReset({
      email: normalizedEmail,
      redirectTo: "/reset-password",
    });
    setIsSubmitting(false);
    if (reqError) {
      setError(reqError.message ?? t("requestFailed"));
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      {sent ? (
        <div className="flex flex-col gap-3 text-center">
          <p className="text-sm font-medium text-foreground">{t("successTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("successMessage")}</p>
          <a
            className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
            href="/login"
          >
            {t("backToLogin")}
          </a>
        </div>
      ) : (
        <>
          <form className="space-y-3.5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                aria-invalid={showEmailError || undefined}
                id="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setTouchedEmail(true)}
                placeholder={t("emailPlaceholder")}
                type="email"
                value={email}
              />
              {showEmailError ? <FieldError>{emailError}</FieldError> : null}
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
        </>
      )}
    </AuthShell>
  );
}
