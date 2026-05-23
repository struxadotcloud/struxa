import { redirect } from "next/navigation";
import { checkSetupComplete } from "@/lib/check-setup";
import { getInstanceSettings } from "@/lib/instance-settings";
import { AuthSettingsProvider } from "@/components/auth-settings-context";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const complete = await checkSetupComplete();
  if (!complete) redirect("/setup");

  const { appName, logoUrl, socialProviders } = await getInstanceSettings();

  return (
    <AuthSettingsProvider value={{ appName, logoUrl, socialProviders }}>
      {children}
    </AuthSettingsProvider>
  );
}
