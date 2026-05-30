"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

/**
 * Renders an extension's sandboxed iframe UI and bridges it to the host shell
 * over `postMessage` (the host side of `@struxa/extension-sdk/client`). The host
 * pushes theme + session context on handshake and relays theme changes; the
 * iframe can request height (auto-resize), host navigation, and host toasts.
 *
 * Data flows separately: the iframe calls `/api/rpc` same-origin with the host
 * session cookie, so no token is passed through this bridge.
 */

// Theme tokens mirrored into the iframe so its UI matches the host palette.
const MIRRORED_TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--primary",
  "--primary-foreground",
  "--muted",
  "--muted-foreground",
  "--border",
  "--radius",
];

function readThemeTokens(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const style = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const name of MIRRORED_TOKENS) {
    const value = style.getPropertyValue(name).trim();
    if (value) out[name] = value;
  }
  return out;
}

function readLocale(): string {
  if (typeof document === "undefined") return "en";
  const match = /(?:^|;\s*)NEXT_LOCALE=([^;]+)/.exec(document.cookie);
  return match?.[1] ?? "en";
}

export interface ExtensionFrameProps {
  extId: string;
  /** Same-origin URL under /ext/<id>/... */
  src: string;
  /** Route context handed to the iframe (e.g. { serverId }). */
  params?: Record<string, string>;
  title?: string;
  className?: string;
  /** When true the frame fills its container; otherwise it auto-sizes to content. */
  fill?: boolean;
}

export function ExtensionFrame({
  extId,
  src,
  params = {},
  title,
  className,
  fill = false,
}: ExtensionFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { data: session } = authClient.useSession();
  const [height, setHeight] = useState<number>(fill ? 0 : 240);

  // Keep latest context in a ref so the message handler isn't re-created.
  const ctxRef = useRef({ resolvedTheme, session, params, extId });
  ctxRef.current = { resolvedTheme, session, params, extId };

  function postInit() {
    const win = ref.current?.contentWindow;
    if (!win) return;
    const { resolvedTheme: mode, session: s, params: p, extId: id } =
      ctxRef.current;
    win.postMessage(
      {
        type: "struxa:host:init",
        context: {
          extId: id,
          theme: { mode: mode ?? "light", tokens: readThemeTokens() },
          session: {
            userId: s?.user?.id ?? null,
            role: (s?.user as { role?: string } | undefined)?.role ?? null,
            locale: readLocale(),
          },
          params: p,
        },
      },
      window.location.origin,
    );
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== ref.current?.contentWindow) return;
      const data = event.data as { type?: string } | null;
      if (!data?.type) return;

      switch (data.type) {
        case "struxa:iframe:ready":
          postInit();
          break;
        case "struxa:iframe:height": {
          if (!fill) {
            const h = (data as { height?: number }).height;
            if (typeof h === "number" && h > 0) setHeight(h);
          }
          break;
        }
        case "struxa:iframe:navigate": {
          const route = (data as { route?: string }).route;
          // Reject protocol-relative ("//evil.com") and allow only absolute
          // same-origin paths ("/foo/bar").
          if (route && route.startsWith("/") && !route.startsWith("//")) {
            router.push(route as never);
          }
          break;
        }
        case "struxa:iframe:toast": {
          const { level, message } = data as {
            level?: "success" | "error" | "info";
            message?: string;
          };
          if (message) {
            if (level === "success") toast.success(message);
            else if (level === "error") toast.error(message);
            else toast(message);
          }
          break;
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill]);

  // Relay theme changes after the initial handshake.
  useEffect(() => {
    const win = ref.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: "struxa:host:theme",
        theme: { mode: resolvedTheme ?? "light", tokens: readThemeTokens() },
      },
      window.location.origin,
    );
  }, [resolvedTheme]);

  return (
    <iframe
      ref={ref}
      src={src}
      title={title ?? `extension:${extId}`}
      // Constrain capabilities; same-origin is required for cookie-authed API calls.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      className={className}
      style={fill ? { width: "100%", height: "100%", border: 0 } : { width: "100%", height, border: 0 }}
    />
  );
}
