"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@struxa/ui/components/button";
import { Alert, AlertDescription } from "@struxa/ui/components/alert";
import { Input } from "@struxa/ui/components/input";
import { Label } from "@struxa/ui/components/label";

import AuthShell from "@/components/auth-shell";
import { authClient } from "@/lib/auth-client";
import { syncLocaleFromDB } from "@/lib/sync-locale";

const emailPattern = /\S+@\S+\.\S+/;

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  const normalizedEmail = email.trim();
  const emailError = !normalizedEmail
    ? t("emailRequired")
    : emailPattern.test(normalizedEmail)
      ? null
      : t("emailInvalid");
  const passwordError = password.length >= 8 ? null : t("passwordMinLength");
  const showEmailError = Boolean(emailError && (hasSubmitted || touchedEmail));
  const showPasswordError = Boolean(passwordError && (hasSubmitted || touchedPassword));
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
        {error ? (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
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
          {showEmailError ? <p className="text-xs text-rose-500">{emailError}</p> : null}
        </div>
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
          {showPasswordError ? <p className="text-xs text-rose-500">{passwordError}</p> : null}
        </div>
        <Button className="w-full" type="submit" disabled={isDisabled}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
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
