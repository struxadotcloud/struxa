import { notFound } from "next/navigation";
import { resolveEnabledPage } from "@struxa/extension-host";
import { ExtensionFrame } from "@/components/extension-frame";
import { extensionFrameSrc } from "@/lib/extension-url";

export const dynamic = "force-dynamic";

/**
 * Generic host route for admin-section extension pages. Mounted under /admin so
 * it inherits the (admin) layout's admin-role gate, on a dynamic segment that
 * only receives paths core admin routes (/admin/nodes, …) didn't claim. The
 * manifest route is unprefixed (e.g. /react-demo); the URL is /admin/react-demo.
 */
export default async function ExtensionAdminPage({
  params,
}: {
  params: Promise<{ seg: string; rest?: string[] }>;
}) {
  const { seg, rest = [] } = await params;
  const route = `/${[seg, ...rest].join("/")}`;

  const resolved = await resolveEnabledPage(route);
  if (!resolved || resolved.page.section !== "admin") notFound();

  const { ext, page } = resolved;
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ExtensionFrame extId={ext.id} src={extensionFrameSrc(ext.id, page.entry ?? "")} fill />
    </div>
  );
}
