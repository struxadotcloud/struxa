"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import AuthShell from "@/components/auth-shell";
import { AuthSettingsProvider } from "@/components/auth-settings-context";
import { useAuthSettings } from "@/components/auth-settings-context";

export default function TwoFactorPage() {
  const { appName, logoUrl } = useAuthSettings();
  return (
    <AuthSettingsProvider value={{ appName, logoUrl, socialProviders: [] }}>
      <TwoFactorForm />
    </AuthSettingsProvider>
  );
}

function TwoFactorForm() {
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
      setError(e instanceof Error ? e.message : "Invalid code. Please try again.");
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

  return (
    <AuthShell
      title="Two-factor authentication"
      subtitle={
        isBackupMode
          ? "Enter one of your backup codes to continue."
          : "Enter the 6-digit code from your authenticator app."
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-foreground">
            {isBackupMode ? "Backup code" : "Authentication code"}
          </label>
          <input
            autoFocus
            autoComplete="one-time-code"
            inputMode={isBackupMode ? "text" : "numeric"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-center font-mono text-sm tracking-widest text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors"
            placeholder={isBackupMode ? "xxxxxxxx-xxxx" : "000000"}
            value={code}
            onChange={handleChange}
            onKeyDown={(e) => { if (e.key === "Enter") void handleVerify(code); }}
            disabled={pending}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <button
          type="button"
          disabled={pending || (!isBackupMode && code.length < 6) || (isBackupMode && !code.trim())}
          onClick={() => void handleVerify(code)}
          className="w-full rounded-lg bg-foreground py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {pending ? "Verifying…" : "Verify"}
        </button>

        <button
          type="button"
          onClick={switchMode}
          className="text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {isBackupMode ? "Use authenticator app instead" : "Use a backup code instead"}
        </button>
      </div>
    </AuthShell>
  );
}
