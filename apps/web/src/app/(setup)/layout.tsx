import { redirect } from "next/navigation";
import { checkSetupComplete } from "@/lib/check-setup";

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const complete = await checkSetupComplete();
  if (complete) redirect("/");
  return <>{children}</>;
}
