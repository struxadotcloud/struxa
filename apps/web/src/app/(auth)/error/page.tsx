import Image from "next/image";
import Link from "next/link";
import { getInstanceSettings } from "@/lib/instance-settings";

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  email_doesnt_match: {
    title: "Email mismatch",
    description: "The social account's email doesn't match your profile. Try linking from your account settings instead.",
  },
  "email_doesn't_match": {
    title: "Email mismatch",
    description: "The social account's email doesn't match your profile. Try linking from your account settings instead.",
  },
  account_not_linked: {
    title: "Account not linked",
    description: "This social account isn't linked to any user. Sign in with your email and password, then link it from account settings.",
  },
  account_already_linked_to_different_user: {
    title: "Account already linked",
    description: "This social account is already connected to a different user.",
  },
  signup_disabled: {
    title: "Registration disabled",
    description: "New account registration is currently disabled. Contact your administrator.",
  },
  oauth_provider_not_found: {
    title: "Provider not found",
    description: "This sign-in provider is not configured. Contact your administrator.",
  },
  unable_to_create_user: {
    title: "Could not create account",
    description: "An error occurred while creating your account. Please try again.",
  },
  unable_to_create_session: {
    title: "Session error",
    description: "An error occurred while creating your session. Please try again.",
  },
  unable_to_link_account: {
    title: "Could not link account",
    description: "An error occurred while linking your account. Please try again.",
  },
  state_mismatch: {
    title: "Request expired",
    description: "The sign-in request expired or was tampered with. Please try again.",
  },
  state_not_found: {
    title: "Request not found",
    description: "The sign-in request could not be found. Please try again.",
  },
  invalid_code: {
    title: "Invalid code",
    description: "The authorization code was invalid or already used. Please try again.",
  },
  please_restart_the_process: {
    title: "Please try again",
    description: "Something went wrong during sign-in. Please start the process again.",
  },
};

const FALLBACK = {
  title: "Authentication error",
  description: "Something went wrong during sign-in. Please try again.",
};

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const { appName, logoUrl } = await getInstanceSettings();
  const { title, description } = (error ? ERROR_MESSAGES[error] : undefined) ?? FALLBACK;

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
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
