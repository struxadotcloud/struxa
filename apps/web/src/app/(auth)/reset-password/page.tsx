import { redirect } from "next/navigation";
import { getInstanceSettings } from "@/lib/instance-settings";
import ResetPasswordForm from "./reset-password-form";

export default async function ResetPasswordPage() {
  const { raw } = await getInstanceSettings();
  if (raw.smtp_enabled !== "true" || !raw.smtp_host) redirect("/login");
  return <ResetPasswordForm />;
}
