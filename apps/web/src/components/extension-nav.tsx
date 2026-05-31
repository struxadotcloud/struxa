"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "next-intl";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@struxa/ui/components/sidebar";
import { orpc } from "@/utils/orpc";
import { getExtensionIcon } from "@/lib/extension-icons";

/**
 * Appends extension-contributed nav entries to a sidebar section. Reads the
 * live registry via the API so installed extensions show up without the
 * hardcoded NAV arrays changing.
 *
 * `routePrefix` accounts for the route group: panel pages live at the manifest
 * route as-is (e.g. /foo); admin pages are mounted under /admin (e.g.
 * /admin/foo).
 */
function routeIsActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  const base = href.replace(/\/$/, "");
  return pathname === base || pathname.startsWith(base + "/");
}

export function ExtensionNav({
  section,
  routePrefix = "",
}: {
  section: "panel" | "admin";
  routePrefix?: string;
}) {
  const pathname = usePathname();
  const allMessages = useMessages() as Record<string, unknown>;
  const extMessages = allMessages.ext as Record<string, Record<string, unknown>> | undefined;
  const { data } = useQuery(
    orpc.extensions.uiPages.queryOptions({ input: { section } }),
  );
  const pages = data ?? [];
  if (!pages.length) return null;

  return (
    <>
      {pages.map((page) => {
        const href = `${routePrefix}${page.route}`;
        const Icon = getExtensionIcon(page.icon);
        const resolved = (extMessages?.[page.extId]?.[page.label] as string | undefined) ?? page.label;
        return (
          <SidebarMenuItem key={`${page.extId}:${page.route}`}>
            <SidebarMenuButton
              render={<Link href={href as never} />}
              isActive={routeIsActive(pathname, href)}
              tooltip={resolved}
              className="h-auto gap-2 rounded-lg py-2 px-3 text-sm transition-colors duration-150"
            >
              <Icon className="h-4 w-4" />
              {resolved}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </>
  );
}
