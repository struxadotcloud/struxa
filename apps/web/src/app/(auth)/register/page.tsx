import { redirect } from "next/navigation";
import { getInstanceSettings } from "@/lib/instance-settings";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  const { registrationEnabled } = await getInstanceSettings();
  if (!registrationEnabled) redirect("/login");
  return <RegisterForm />;
}
