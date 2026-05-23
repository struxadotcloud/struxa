import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getInstanceSettings } from "@/lib/instance-settings";

const KNOWN_ERROR_KEYS = new Set([
  "email_doesnt_match",
  "email_doesn't_match",
  "account_not_linked",
  "account_already_linked_to_different_user",
  "signup_disabled",
  "oauth_provider_not_found",
  "unable_to_create_user",
  "unable_to_create_session",
  "unable_to_link_account",
  "state_mismatch",
  "state_not_found",
  "invalid_code",
  "please_restart_the_process",
]);

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const t = await getTranslations("auth.errors");
  const { error } = await searchParams;
  const { appName, logoUrl } = await getInstanceSettings();

  const normalizedKey = error?.replace(/'/g, "") ?? null;
  const knownKey = normalizedKey && KNOWN_ERROR_KEYS.has(normalizedKey) ? normalizedKey : null;
  const lookupKey = knownKey === "email_doesn't_match" ? "email_doesnt_match" : knownKey;

  const title = lookupKey ? t(`${lookupKey}.title` as never) : t("fallbackTitle");
  const description = lookupKey ? t(`${lookupKey}.description` as never) : t("fallbackDescription");

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh max-w-xl items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="mb-1">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={appName} className="h-7 w-auto" />
              ) : (
                <>
                  <Image src="/logo-dark.svg" alt="Struxa" width={96} height={28} priority className="h-7 w-auto dark:hidden" />
                  <Image src="/logo-white.svg" alt="Struxa" width={96} height={28} priority className="hidden h-7 w-auto dark:block" />
                </>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-4 rounded-2xl border bg-card p-6 shadow-sm text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <svg className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {error && (
              <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">{error}</code>
            )}
            <div className="flex gap-2">
              <Link
                href="/login"
                className="rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
              >
                {t("backToLogin")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
