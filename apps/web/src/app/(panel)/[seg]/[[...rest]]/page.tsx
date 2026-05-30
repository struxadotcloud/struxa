import { notFound } from "next/navigation";
import { resolveEnabledPage } from "@struxa/extension-host";
import { ExtensionFrame } from "@/components/extension-frame";
import { extensionFrameSrc } from "@/lib/extension-url";

// Extension pages are resolved from the DB catalog at request time.
export const dynamic = "force-dynamic";

/**
 * Generic host route for panel-section extension pages. It sits on a dynamic
 * segment, so it only ever receives paths the core site didn't statically
 * define (/account, /servers, … always win). The requested path is matched
 * against enabled extensions' declared routes — the segment is just a URL part,
 * not an extension id.
 */
export default async function ExtensionPanelPage({
  params,
}: {
  params: Promise<{ seg: string; rest?: string[] }>;
}) {
  const { seg, rest = [] } = await params;
  const route = `/${[seg, ...rest].join("/")}`;

  const resolved = await resolveEnabledPage(route);
  if (!resolved || resolved.page.section !== "panel") notFound();

  const { ext, page } = resolved;
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ExtensionFrame extId={ext.id} src={extensionFrameSrc(ext.id, page.entry ?? "")} fill />
    </div>
  );
}
