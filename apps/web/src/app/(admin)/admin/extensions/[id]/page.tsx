"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import {
  Check,
  ChevronLeft,
  Download,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@struxa/ui/components/dialog";
import { orpc, queryClient } from "@/utils/orpc";
import { toast } from "sonner";

function invalidate(id: string) {
  void queryClient.invalidateQueries({ queryKey: orpc.extensions.key() });
  void queryClient.invalidateQueries({
    queryKey: orpc.extensions.getDetails.queryOptions({ input: { id } }).queryKey,
  });
}

function permInfo(p: string): { label: string; description: string } {
  if (p === "db:own") return { label: "Database tables", description: "Creates and manages its own prefixed database tables." };
  if (p === "api:public") return { label: "Public API", description: "Adds API routes accessible without authentication." };
  if (p === "api:protected") return { label: "Authenticated API", description: "Adds API routes accessible to signed-in users." };
  if (p === "api:admin") return { label: "Admin API", description: "Adds API routes accessible to admins only." };
  if (p.startsWith("hook:")) return { label: `Hook: ${p.slice(5)}`, description: `Listens to the ${p.slice(5)} event.` };
  if (p.startsWith("core.metadata:")) return { label: `Metadata: ${p.slice(14)}`, description: `Reads and writes metadata on ${p.slice(14)} records.` };
  if (p.startsWith("settings:")) return { label: "Settings storage", description: `Stores configuration under the ${p.slice(9)} key space.` };
  return { label: p, description: "" };
}

const CAPS_PREVIEW = 3;

function CapabilitiesSidebar({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = useState(false);
  const preview = permissions.slice(0, CAPS_PREVIEW);
  const rest = permissions.length - CAPS_PREVIEW;

  if (permissions.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-2 border-t border-border pt-4 text-xs">
        <span className="text-muted-foreground">Capabilities</span>
        {preview.map((p) => {
          const info = permInfo(p);
          return (
            <div key={p} className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground">{info.label}</span>
              <span className="text-[11px] text-muted-foreground leading-snug">{info.description}</span>
            </div>
          );
        })}
        {rest > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="text-left text-[11px] text-primary hover:underline"
          >
            Show {rest} more…
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>All capabilities</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5">
            {permissions.map((p, i) => {
              const info = permInfo(p);
              return (
                <div
                  key={p}
                  className={`flex items-start gap-4 py-3 ${i !== 0 ? "border-t border-border/50" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{info.label}</p>
                    {info.description && (
                      <p className="mt-0.5 text-xs leading-snug text-foreground/50">{info.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogPopup>
      </Dialog>
    </>
  );
}

function idToHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h % 360;
}

function ExtAvatar({ id, name, iconUrl, size = 72 }: { id: string; name: string; iconUrl?: string; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const hue = idToHue(id);
  const letter = (name[0] ?? id[0] ?? "?").toUpperCase();

  if (iconUrl && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={iconUrl} alt={name} onError={() => setImgFailed(true)}
        className="rounded-2xl object-cover" style={{ width: size, height: size }} />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl font-semibold text-white"
      style={{ width: size, height: size, background: `hsl(${hue} 55% 45%)`, fontSize: size * 0.36 }}
    >
      {letter}
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full" style={{ background: "#1D9BF0" }}>
      <Check className="h-2 w-2 text-white" strokeWidth={3} />
    </span>
  );
}

export default function ExtensionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("extensions");
  const tc = useTranslations("common");

  const { data, isLoading } = useQuery(
    orpc.extensions.getDetails.queryOptions({ input: { id } }),
  );

  const [confirmInstall, setConfirmInstall] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [dropTables, setDropTables] = useState(false);

  const installMutation = useMutation(
    orpc.extensions.install.mutationOptions({
      onSuccess: () => { invalidate(id); toast.success(t("installed_toast")); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const enableMutation = useMutation(
    orpc.extensions.enable.mutationOptions({
      onSuccess: () => { invalidate(id); toast.success(t("enabled")); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const disableMutation = useMutation(
    orpc.extensions.disable.mutationOptions({ onSuccess: () => invalidate(id) }),
  );
  const uninstallMutation = useMutation(
    orpc.extensions.uninstall.mutationOptions({
      onSuccess: () => { invalidate(id); router.push("/admin/extensions" as never); },
      onError: (e) => toast.error(e.message),
    }),
  );

  type RegEntry = NonNullable<NonNullable<typeof data>["registry"]> & { readme?: string };
  const reg = data?.registry as RegEntry | null | undefined;
  const ins = data?.installed;
  type ManifestJson = { name?: string; author?: string; description?: string; permissions?: string[] };
  const mj = ins?.manifest as ManifestJson | null | undefined;
  const name = reg?.name ?? mj?.name ?? id;
  const author = reg?.author ?? mj?.author;
  const version = reg?.version ?? ins?.version ?? "—";
  const description = reg?.description ?? mj?.description;
  const permissions: string[] = reg?.permissions ?? mj?.permissions ?? [];
  const isInstalled = !!ins;
  const isEnabled = ins?.enabled ?? false;
  const isActive = ins?.runtimeStatus === "active";
  const isErrored = ins?.runtimeStatus === "errored";

  return (
    <>
      <Dialog open={confirmUninstall} onOpenChange={(o) => { if (!o) { setConfirmUninstall(false); setDropTables(false); } }}>
        <DialogPopup showCloseButton={false}>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <DialogTitle>{t("uninstallConfirmTitle")}</DialogTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("uninstallConfirmDescription")}</p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-destructive/40 has-[:checked]:bg-destructive/5">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 accent-destructive"
                checked={dropTables}
                onChange={(e) => setDropTables(e.target.checked)}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{t("uninstallDropTables")}</span>
                <span className="text-xs leading-snug text-muted-foreground">{t("uninstallDropTablesHint")}</span>
              </div>
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setConfirmUninstall(false); setDropTables(false); }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {tc("cancel")}
              </button>
              <button
                disabled={uninstallMutation.isPending}
                onClick={() => { setConfirmUninstall(false); uninstallMutation.mutate({ id, dropTables }); }}
                className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t("uninstall")}
              </button>
            </div>
          </div>
        </DialogPopup>
      </Dialog>

      <Dialog open={confirmInstall} onOpenChange={(o) => !o && setConfirmInstall(false)}>
        <DialogPopup showCloseButton={false}>
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <DialogTitle>{t("installConfirmTitle")}</DialogTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("installConfirmDescription")}</p>
            </div>

            {permissions.length > 0 ? (
              <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {permissions.map((p) => {
                  const info = permInfo(p);
                  return (
                    <div key={p} className="flex items-start gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{info.label}</p>
                        {info.description && (
                          <p className="text-xs leading-snug text-muted-foreground">{info.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("installNoPermissions")}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmInstall(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {tc("cancel")}
              </button>
              <button
                disabled={installMutation.isPending}
                onClick={() => { setConfirmInstall(false); reg && installMutation.mutate({ id: reg.id, version: reg.version }); }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {t("install")}
              </button>
            </div>
          </div>
        </DialogPopup>
      </Dialog>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mx-auto max-w-5xl">

          <button
            onClick={() => router.back()}
            className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {t("backToExtensions")}
          </button>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">{tc("loading")}</p>
          ) : (
            <div className="flex gap-8">
              {/* ── Left sidebar ── */}
              <div className="flex w-52 shrink-0 flex-col gap-4">
                <ExtAvatar id={id} name={name} iconUrl={`/ext/${id}/icon.svg`} size={80} />

                <div className="flex flex-col gap-1">
                  <h1 className="text-base font-semibold text-foreground leading-tight">{name}</h1>
                  {author && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{author}</span>
                      {author.toLowerCase() === "struxa" && <VerifiedBadge />}
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">v{version}</span>
                </div>

                {isInstalled && (
                  <div className="flex flex-wrap gap-1.5">
                    {isErrored && (
                      <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">{t("errored")}</span>
                    )}
                    {isEnabled && isActive && (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">{t("active")}</span>
                    )}
                    {isInstalled && !isEnabled && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Disabled</span>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {!isInstalled ? (
                    <button
                      disabled={installMutation.isPending}
                      onClick={() => setConfirmInstall(true)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      {t("install")}
                    </button>
                  ) : (
                    <>
                      {isEnabled ? (
                        <button
                          onClick={() => disableMutation.mutate({ id })}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <PowerOff className="h-4 w-4" />
                          {t("disable")}
                        </button>
                      ) : (
                        <button
                          onClick={() => enableMutation.mutate({ id })}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                        >
                          <Power className="h-4 w-4" />
                          {t("enable")}
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmUninstall(true)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("uninstall")}
                      </button>
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-4 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">{t("extensionId")}</span>
                    <code className="font-mono text-foreground">{id}</code>
                  </div>
                  {author && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">{t("publisher")}</span>
                      <span className="text-foreground">{author}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">Version</span>
                    <span className="text-foreground">{version}</span>
                  </div>
                </div>

                <CapabilitiesSidebar permissions={permissions} />
              </div>

              {/* ── Main content ── */}
              <div className="flex min-w-0 flex-1 flex-col gap-5">
                {!reg && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-500">
                    {t("notInRegistry")}
                  </div>
                )}

                {ins?.lastError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                    {ins.lastError}
                  </div>
                )}

                {reg?.readme ? (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, [rehypeSanitize, {
                        ...defaultSchema,
                        attributes: {
                          ...defaultSchema.attributes,
                          div: [...(defaultSchema.attributes?.div ?? []), "align"],
                          p: [...(defaultSchema.attributes?.p ?? []), "align"],
                          img: ["src", "alt", "width", "height", "title"],
                        },
                      }]]}
                      components={{
                        h1: ({ children }) => <h1 className="mb-3 mt-6 text-lg font-semibold text-foreground first:mt-0">{children}</h1>,
                        h2: ({ children }) => <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>,
                        h3: ({ children }) => <h3 className="mb-1.5 mt-4 text-sm font-semibold text-foreground">{children}</h3>,
                        p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-foreground/90">{children}</p>,
                        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>,
                        code: ({ children, className }) => {
                          const isBlock = className?.includes("language-");
                          return isBlock
                            ? <code className={`${className ?? ""} text-xs`}>{children}</code>
                            : <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>;
                        },
                        pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-xl border border-border bg-muted p-4 text-xs">{children}</pre>,
                        ul: ({ children }) => <ul className="mb-3 list-disc pl-5 text-sm text-foreground/90 [&>li]:mb-1">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 text-sm text-foreground/90 [&>li]:mb-1">{children}</ol>,
                        blockquote: ({ children }) => <blockquote className="mb-3 border-l-2 border-border pl-4 text-sm italic text-muted-foreground">{children}</blockquote>,
                        table: ({ children }) => <div className="mb-3 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
                        th: ({ children }) => <th className="border border-border bg-muted px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">{children}</th>,
                        td: ({ children }) => <td className="border border-border px-3 py-1.5 text-xs text-foreground/90">{children}</td>,
                        hr: () => <hr className="my-5 border-border" />,
                        img: ({ src, alt }) => <img src={src} alt={alt ?? ""} className="my-2 max-w-full rounded-lg" />, // eslint-disable-line @next/next/no-img-element
                      }}
                    >
                      {reg.readme}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {description ?? <span className="text-muted-foreground">{t("noDescription")}</span>}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
