"use client";

import type * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@struxa/ui/components/button";
import { Input } from "@struxa/ui/components/input";
import { Label } from "@struxa/ui/components/label";

import AuthShell from "@/components/auth-shell";
import { useAuthSettings } from "@/components/auth-settings-context";
import { authClient } from "@/lib/auth-client";
import { syncLocaleFromDB } from "@/lib/sync-locale";

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

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const { smtpEnabled } = useAuthSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const normalizedEmail = email.trim();
  const emailError = !normalizedEmail
    ? t("emailRequired")
    : emailPattern.test(normalizedEmail)
      ? null
      : t("emailInvalid");
  const passwordError = password.length >= 8 ? null : t("passwordMinLength");
  const showEmailError = Boolean(emailError && hasSubmitted);
  const showPasswordError = Boolean(passwordError && hasSubmitted);
  const isDisabled = Boolean(emailError || passwordError || isSubmitting);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setError(null);
    if (emailError || passwordError) {
      setError(t("fixHighlighted"));
      return;
    }
    setIsSubmitting(true);
    const { error: signInError } = await authClient.signIn.email({
      email: normalizedEmail,
      password,
    });
    setIsSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? t("signInFailed"));
      return;
    }
    await syncLocaleFromDB();
    router.push("/");
  };

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            aria-invalid={showEmailError || undefined}
            id="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("emailPlaceholder")}
            type="email"
            value={email}
          />
          {showEmailError ? <FieldError>{emailError}</FieldError> : null}
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            {smtpEnabled ? (
              <a
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                href="/forgot-password"
              >
                {t("forgotPassword")}
              </a>
            ) : null}
          </div>
          <Input
            aria-invalid={showPasswordError || undefined}
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("passwordPlaceholder")}
            type="password"
            value={password}
          />
          {showPasswordError ? <FieldError>{passwordError}</FieldError> : null}
        </div>
        <Button className="w-full" type="submit" disabled={isDisabled}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
        {error ? <FieldError>{error}</FieldError> : null}
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <a
          className="font-medium text-foreground transition-colors hover:text-foreground/80"
          href="/register"
        >
          {t("register")}
        </a>
      </p>
    </AuthShell>
  );
}
