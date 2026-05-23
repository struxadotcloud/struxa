import { redirect } from "next/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { PanelShell } from "@/components/panel-shell";
import { checkSetupComplete } from "@/lib/check-setup";
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const complete = await checkSetupComplete();
  if (!complete) redirect("/setup");

  return (
    <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
      <div className="h-svh overflow-hidden">
        <PanelShell>{children}</PanelShell>
      </div>
    </ThemeProvider>
  );
}
