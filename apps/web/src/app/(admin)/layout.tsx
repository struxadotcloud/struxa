import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@struxa/auth";
import { AdminShell } from "@/components/admin-shell";
import { checkSetupComplete } from "@/lib/check-setup";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const complete = await checkSetupComplete();
  if (!complete) redirect("/setup");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  return <AdminShell>{children}</AdminShell>;
}
