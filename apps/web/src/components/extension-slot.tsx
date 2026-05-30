"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { ExtensionFrame } from "./extension-frame";
import { extensionFrameSrc } from "@/lib/extension-url";

/**
 * Renders any extension widgets registered for a named slot, letting extensions
 * augment existing host pages without the host knowing about them at build time.
 * Drop `<ExtensionSlot name="server.overview.after" context={{ serverId }} />`
 * into a page where extension content is welcome.
 */
export interface ExtensionSlotProps {
  name: string;
  /** Context passed to each widget iframe (e.g. the current serverId). */
  context?: Record<string, string>;
  className?: string;
}

export function ExtensionSlot({ name, context = {}, className }: ExtensionSlotProps) {
  const { data } = useQuery(orpc.extensions.slots.queryOptions({ input: { name } }));
  const widgets = data ?? [];
  if (!widgets.length) return null;

  return (
    <div className={className} data-extension-slot={name}>
      {widgets.map((w) => (
        <ExtensionFrame
          key={`${w.extId}:${w.widget}`}
          extId={w.extId}
          src={extensionFrameSrc(w.extId, w.widget.replace(/^\/[^/]+\//, ""))}
          params={context}
        />
      ))}
    </div>
  );
}
