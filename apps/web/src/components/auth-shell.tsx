import type * as React from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-svh bg-[#0a0a0a] text-white">
      <div className="mx-auto flex min-h-svh max-w-4xl items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-xl font-semibold text-white sm:text-2xl">{title}</h1>
            <p className="text-sm text-[#888888]">{subtitle}</p>
          </div>

          <div className="flex w-full flex-col gap-4 rounded-lg border border-[#222222] bg-[#141414] p-5 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
