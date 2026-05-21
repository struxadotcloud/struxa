import type * as React from "react";
import Image from "next/image";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh max-w-xl items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="mb-1">
              <Image src="/logo-dark.svg" alt="Struxa" width={96} height={28} priority className="h-7 w-auto dark:hidden" />
              <Image src="/logo-white.svg" alt="Struxa" width={96} height={28} priority className="hidden h-7 w-auto dark:block" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="flex w-full flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
