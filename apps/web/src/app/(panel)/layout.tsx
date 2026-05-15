import { ThemeProvider } from "@/components/theme-provider";
import { PanelShell } from "@/components/panel-shell";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
      <div className="h-svh overflow-hidden">
        <PanelShell>{children}</PanelShell>
      </div>
    </ThemeProvider>
  );
}
