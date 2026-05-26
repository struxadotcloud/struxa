import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@struxa/auth";
import { checkSetupComplete } from "@/lib/check-setup";
import { ThemeProvider } from "@/components/theme-provider";

export default async function AdminFullscreenLayout({ children }: { children: React.ReactNode }) {
  const complete = await checkSetupComplete();
  if (!complete) redirect("/setup");

  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  return (
    <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
      <div className="h-svh overflow-hidden bg-background">
        {children}
      </div>
    </ThemeProvider>
  );
}
