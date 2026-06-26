import { redirect } from "next/navigation";
import { getInstanceSettings } from "@/lib/instance-settings";
import ForgotPasswordForm from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const { raw } = await getInstanceSettings();
  if (raw.smtp_enabled !== "true" || !raw.smtp_host) redirect("/login");
  return <ForgotPasswordForm />;
}
