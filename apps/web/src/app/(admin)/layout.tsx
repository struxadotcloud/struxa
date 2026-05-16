import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@struxa/auth";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  return <AdminShell>{children}</AdminShell>;
}
