"use client";

import type * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@struxa/ui/components/button";
import { Input } from "@struxa/ui/components/input";
import { Label } from "@struxa/ui/components/label";

import AuthShell from "@/components/auth-shell";
import { AuthSettingsProvider, useAuthSettings } from "@/components/auth-settings-context";
import { authClient } from "@/lib/auth-client";

export default function TwoFactorPage() {
  const { appName, logoUrl, ogDescription } = useAuthSettings();
  return (
    <AuthSettingsProvider value={{ appName, logoUrl, ogDescription, socialProviders: [], smtpEnabled: false }}>
      <TwoFactorForm />
    </AuthSettingsProvider>
  );
}

function TwoFactorForm() {
  const t = useTranslations("auth.twoFactor");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleVerify(codeValue: string) {
    if (!codeValue.trim()) return;
    setError("");
    setPending(true);
    try {
      if (isBackupMode) {
        const res = await authClient.twoFactor.verifyBackupCode({ code: codeValue.trim() });
        if (res.error) throw new Error(res.error.message);
      } else {
        const res = await authClient.twoFactor.verifyTotp({ code: codeValue.trim() });
        if (res.error) throw new Error(res.error.message);
      }
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("invalidCode"));
      setPending(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = isBackupMode ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(v);
    if (!isBackupMode && v.length === 6) void handleVerify(v);
  }

  function switchMode() {
    setIsBackupMode((b) => !b);
    setCode("");
    setError("");
  }

  const isVerifyDisabled = pending || (!isBackupMode && code.length < 6) || (isBackupMode && !code.trim());

  return (
    <AuthShell
      title={t("title")}
      subtitle={isBackupMode ? t("subtitleBackup") : t("subtitleTotp")}
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="2fa-code">
            {isBackupMode ? t("backupCodeLabel") : t("codeLabel")}
          </Label>
          <Input
            id="2fa-code"
            autoFocus
            autoComplete="one-time-code"
            inputMode={isBackupMode ? "text" : "numeric"}
            className="text-center font-mono tracking-widest"
            placeholder={isBackupMode ? t("backupCodePlaceholder") : t("codePlaceholder")}
            value={code}
            onChange={handleChange}
            onKeyDown={(e) => { if (e.key === "Enter") void handleVerify(code); }}
            disabled={pending}
            aria-invalid={error ? true : undefined}
          />
          {error ? (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 3.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-1.5 0v-3.5zm.75 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
              </svg>
              {error}
            </p>
          ) : null}
        </div>

        <Button type="button" disabled={isVerifyDisabled} onClick={() => void handleVerify(code)} className="w-full">
          {pending ? t("verifying") : t("verify")}
        </Button>

        <button
          type="button"
          onClick={switchMode}
          className="text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {isBackupMode ? t("useAuthenticator") : t("useBackupCode")}
        </button>
      </div>
    </AuthShell>
  );
}
