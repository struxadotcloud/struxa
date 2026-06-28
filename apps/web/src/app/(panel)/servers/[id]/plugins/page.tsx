"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Search, ExternalLink, Download, Puzzle, X,
  Code2, MessageSquare, CircleAlert, BookOpen, Heart,
  ScrollText, Calendar, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import Loader from "@/components/loader";
import { useIsMobile } from "@struxa/ui/hooks/use-media-query";
import {
  Dialog,
  DialogPopup,
} from "@struxa/ui/components/dialog";
import {
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetPanel,
  SheetFooter,
  SheetClose,
} from "@struxa/ui/components/sheet";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@struxa/ui/components/select";

interface ModrinthProject {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  icon_url: string | null;
  downloads: number;
  categories: string[];
  date_modified: string;
  project_type: string;
}

interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  loaders: string[];
  game_versions: string[];
  date_published: string;
  files: { url: string; filename: string; primary: boolean; size: number }[];
}

interface ModrinthProjectDetail {
  game_versions: string[];
  loaders: string[];
  categories: string[];
  additional_categories: string[];
  license: { id: string; name: string; url: string | null } | null;
  source_url: string | null;
  discord_url: string | null;
  issues_url: string | null;
  wiki_url: string | null;
  donation_urls: { id: string; platform: string; url: string }[];
  published: string;
  updated: string;
  client_side: string;
  server_side: string;
}

interface ModrinthMember {
  role: string;
  ordering: number;
  user: { id: string; username: string; avatar_url: string | null; name: string | null };
}

const MODRINTH_API = "https://api.modrinth.com/v2";
const PLUGIN_LOADERS = ["paper", "spigot", "bukkit", "purpur", "folia"];
const LOADER_ORDER = ["paper", "purpur", "folia", "spigot", "bukkit"];
const FACETS = encodeURIComponent(JSON.stringify([["project_type:plugin"]]));

const PROSE = [
  "text-sm text-foreground leading-relaxed",
  "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-foreground",
  "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-foreground",
  "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-foreground",
  "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-foreground",
  "[&_p]:mb-3 [&_p]:leading-relaxed [&_p]:text-muted-foreground",
  "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:text-muted-foreground",
  "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:text-muted-foreground",
  "[&_li]:leading-relaxed",
  "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_code]:text-foreground",
  "[&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:mb-3 [&_pre]:text-xs [&_pre]:font-mono",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:mb-3",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/40 [&_a:hover]:decoration-primary",
  "[&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-3",
  "[&_hr]:border-border [&_hr]:my-5",
  "[&_table]:w-full [&_table]:text-sm [&_table]:border-collapse [&_table]:mb-3",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold",
  "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-xs",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_details]:mb-3 [&_details]:rounded-lg [&_details]:border [&_details]:border-border [&_details]:p-3",
  "[&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-sm",
].join(" ");

function fmtDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function loaderLabel(l: string) {
  return l.charAt(0).toUpperCase() + l.slice(1);
}

function versionLabel(v: ModrinthVersion) {
  const mc = v.game_versions[0];
  return mc ? `${v.version_number} — MC ${mc}` : v.version_number;
}

function PluginIcon({ plugin, size = "md" }: { plugin: ModrinthProject; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-16 w-16" : size === "md" ? "h-12 w-12" : "h-9 w-9";
  const iconDims = size === "lg" ? "h-8 w-8" : size === "md" ? "h-6 w-6" : "h-4 w-4";
  const rounded = size === "lg" ? "rounded-xl" : "rounded-lg";
  return (
    <div className={`${dims} shrink-0 overflow-hidden ${rounded} bg-muted flex items-center justify-center`}>
      {plugin.icon_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={plugin.icon_url}
          alt={plugin.title}
          className={`${dims} object-cover`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <Puzzle className={`${iconDims} text-muted-foreground`} />
      )}
    </div>
  );
}

function PluginCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
        <div className="flex flex-1 flex-col gap-2 pt-0.5">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-14 rounded-full bg-muted" />
        <div className="h-5 w-10 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function PluginCard({ plugin, onClick }: { plugin: ModrinthProject; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <PluginIcon plugin={plugin} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <p className="truncate text-sm font-semibold text-foreground leading-tight">{plugin.title}</p>
          <p className="truncate text-xs text-muted-foreground">by {plugin.author}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
          <Download className="h-3 w-3" />
          {fmtDownloads(plugin.downloads)}
        </div>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{plugin.description}</p>
      {plugin.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {plugin.categories.slice(0, 3).map((cat) => (
            <span key={cat} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
              {cat}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function VersionPicker({
  projectId,
  onSelect,
}: {
  projectId: string;
  onSelect: (v: ModrinthVersion | null) => void;
}) {
  const t = useTranslations("panel.plugins");
  const [allVersions, setAllVersions] = useState<ModrinthVersion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLoader, setSelectedLoader] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setAllVersions(null);
    setSelectedLoader(null);
    setSelectedVersionId(null);
    onSelect(null);

    fetch(`${MODRINTH_API}/project/${projectId}/version`)
      .then((r) => r.json() as Promise<ModrinthVersion[]>)
      .then((all) => {
        const compatible = all.filter(
          (v) => v.loaders.length === 0 || v.loaders.some((l) => PLUGIN_LOADERS.includes(l)),
        );
        const pool = compatible.length > 0 ? compatible : all;
        setAllVersions(pool);

        const counts = new Map<string, number>();
        for (const v of pool)
          for (const l of v.loaders)
            if (PLUGIN_LOADERS.includes(l)) counts.set(l, (counts.get(l) ?? 0) + 1);

        const bestLoader = LOADER_ORDER.find((l) => counts.has(l)) ?? pool[0]?.loaders[0] ?? null;
        setSelectedLoader(bestLoader);

        const first = bestLoader ? (pool.find((v) => v.loaders.includes(bestLoader)) ?? pool[0]) : pool[0];
        if (first) { setSelectedVersionId(first.id); onSelect(first); }
      })
      .catch(() => setAllVersions([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const availableLoaders = allVersions
    ? LOADER_ORDER.filter((l) => allVersions.some((v) => v.loaders.includes(l)))
    : [];

  const filteredVersions = allVersions && selectedLoader
    ? allVersions.filter((v) => v.loaders.includes(selectedLoader))
    : (allVersions ?? []);

  const selectedVersion = filteredVersions.find((v) => v.id === selectedVersionId) ?? null;

  function handleLoaderChange(loader: string | null) {
    if (!loader) return;
    setSelectedLoader(loader);
    const versions = allVersions?.filter((v) => v.loaders.includes(loader)) ?? [];
    const first = versions[0] ?? null;
    setSelectedVersionId(first?.id ?? null);
    onSelect(first);
  }

  function handleVersionChange(id: string | null) {
    if (!id) return;
    const v = filteredVersions.find((v) => v.id === id) ?? null;
    setSelectedVersionId(id);
    onSelect(v);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-9 rounded-lg bg-muted animate-pulse" />
        <div className="h-9 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!allVersions || allVersions.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("noVersions")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {availableLoaders.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("loaderLabel")}</p>
          <Select value={selectedLoader ?? ""} onValueChange={handleLoaderChange}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue>{selectedLoader ? loaderLabel(selectedLoader) : t("selectVersion")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableLoaders.map((l) => (
                <SelectItem key={l} value={l}>{loaderLabel(l)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">{t("versionLabel")}</p>
        <Select value={selectedVersionId ?? ""} onValueChange={handleVersionChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue>{selectedVersion ? versionLabel(selectedVersion) : t("selectVersion")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {filteredVersions.map((v) => (
              <SelectItem key={v.id} value={v.id}>{versionLabel(v)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Readme({ body }: { body: string | null | undefined }) {
  if (body === undefined) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`h-3 rounded bg-muted ${i % 3 === 2 ? "w-3/4" : "w-full"}`} />
        ))}
      </div>
    );
  }
  if (!body) return <p className="text-xs text-muted-foreground">No description available.</p>;

  return (
    <div className={PROSE}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
        {body}
      </ReactMarkdown>
    </div>
  );
}

const DONATE_LABELS: Record<string, string> = {
  "ko-fi": "Ko-fi",
  patreon: "Patreon",
  "open-collective": "Open Collective",
  github: "GitHub Sponsors",
  bmac: "Buy Me a Coffee",
  paypal: "PayPal",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const s = Math.floor(diff / 1000);
  if (s < 60) return rtf.format(-s, "second");
  const m = Math.floor(s / 60);
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.floor(m / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const d = Math.floor(h / 24);
  if (d < 30) return rtf.format(-d, "day");
  const mo = Math.floor(d / 30);
  if (mo < 12) return rtf.format(-mo, "month");
  return rtf.format(-Math.floor(mo / 12), "year");
}

function MetaSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function MetaLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {label}
      <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground/60" />
    </a>
  );
}

function safeUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.toString() : undefined;
  } catch { return undefined; }
}

function ProjectMetadata({
  detail,
  members,
}: {
  detail: ModrinthProjectDetail | null | undefined;
  members: ModrinthMember[] | null | undefined;
}) {
  if (detail === undefined) {
    return (
      <div className="flex flex-col gap-4">
        {[80, 60, 100, 70].map((w, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
            <div className="h-3 rounded bg-muted animate-pulse" style={{ width: `${w}%` }} />
            <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!detail) return null;

  const links: { href: string; icon: React.ElementType; label: string }[] = [
    ...(safeUrl(detail.source_url) ? [{ href: safeUrl(detail.source_url)!, icon: Code2, label: "View source" }] : []),
    ...(safeUrl(detail.discord_url) ? [{ href: safeUrl(detail.discord_url)!, icon: MessageSquare, label: "Join Discord" }] : []),
    ...(safeUrl(detail.issues_url) ? [{ href: safeUrl(detail.issues_url)!, icon: CircleAlert, label: "Report issues" }] : []),
    ...(safeUrl(detail.wiki_url) ? [{ href: safeUrl(detail.wiki_url)!, icon: BookOpen, label: "Wiki" }] : []),
    ...detail.donation_urls.flatMap((d) => {
      const url = safeUrl(d.url);
      return url ? [{ href: url, icon: Heart, label: `Donate on ${DONATE_LABELS[d.id] ?? d.platform}` }] : [];
    }),
  ];

  const allCategories = [...detail.categories, ...detail.additional_categories];
  const sortedMembers = [...(members ?? [])].sort((a, b) => a.ordering - b.ordering);

  return (
    <div className="flex flex-col gap-5">
      {/* Links */}
      {links.length > 0 && (
        <MetaSection title="Links">
          <div className="flex flex-col gap-1.5">
            {links.map((l) => <MetaLink key={l.href} {...l} />)}
          </div>
        </MetaSection>
      )}

      {/* Tags */}
      {allCategories.length > 0 && (
        <MetaSection title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((cat) => (
              <span key={cat} className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground capitalize">{cat}</span>
            ))}
          </div>
        </MetaSection>
      )}

      {/* Creators */}
      {sortedMembers.length > 0 && (
        <MetaSection title="Creators">
          <div className="flex flex-col gap-2">
            {sortedMembers.map((m) => (
              <div key={m.user.id} className="flex items-center gap-2">
                <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
                  {m.user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.user.avatar_url} alt={m.user.username} className="h-7 w-7 object-cover" />
                  ) : (
                    <div className="h-7 w-7 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                      {m.user.username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-medium text-foreground">{m.user.username}</span>
                  <span className="text-[10px] text-muted-foreground">{m.role}</span>
                </div>
              </div>
            ))}
          </div>
        </MetaSection>
      )}

      {/* Details */}
      <MetaSection title="Details">
        <div className="flex flex-col gap-1.5">
          {detail.license && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ScrollText className="h-3.5 w-3.5 shrink-0" />
              {safeUrl(detail.license.url) ? (
                <a href={safeUrl(detail.license.url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {detail.license.name || detail.license.id}
                </a>
              ) : (
                <span>{detail.license.name || detail.license.id}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            Published {timeAgo(detail.published)}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
            Updated {timeAgo(detail.updated)}
          </div>
        </div>
      </MetaSection>
    </div>
  );
}

function PluginDetail({
  plugin,
  serverId,
  onClose,
}: {
  plugin: ModrinthProject;
  serverId: string;
  onClose: () => void;
}) {
  const t = useTranslations("panel.plugins");
  const isMobile = useIsMobile();
  const [body, setBody] = useState<string | null | undefined>(undefined);
  const [detail, setDetail] = useState<ModrinthProjectDetail | null | undefined>(undefined);
  const [members, setMembers] = useState<ModrinthMember[] | null | undefined>(undefined);
  const [selectedVersion, setSelectedVersion] = useState<ModrinthVersion | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installSheetOpen, setInstallSheetOpen] = useState(false);

  useEffect(() => {
    setBody(undefined);
    setDetail(undefined);
    setMembers(undefined);
    Promise.all([
      fetch(`${MODRINTH_API}/project/${plugin.project_id}`).then((r) => r.json() as Promise<ModrinthProjectDetail & { body: string }>),
      fetch(`${MODRINTH_API}/project/${plugin.project_id}/members`).then((r) => r.json() as Promise<ModrinthMember[]>),
    ])
      .then(([proj, mems]) => {
        setBody(proj.body ?? null);
        setDetail(proj);
        setMembers(mems);
      })
      .catch(() => { setBody(null); setDetail(null); setMembers(null); });
  }, [plugin.project_id]);

  async function install() {
    const file = selectedVersion?.files.find((f) => f.primary) ?? selectedVersion?.files[0];
    if (!file) return;
    setInstalling(true);
    try {
      const res = await fetch(`/api/servers/${serverId}/files/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: file.url, root: "/plugins" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("installSuccess"));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("installError"));
    } finally {
      setInstalling(false);
    }
  }

  const installBtn = (
    <button
      type="button"
      onClick={install}
      disabled={!selectedVersion || installing}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
    >
      {installing ? t("installing") : t("install")}
    </button>
  );

  if (!isMobile) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogPopup
          showCloseButton={false}
          className="flex max-w-5xl h-[85vh] p-0 overflow-hidden rounded-2xl shadow-2xl"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Left column */}
          <div className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border p-6">
            <div className="flex items-start gap-3 pr-6">
              <PluginIcon plugin={plugin} size="lg" />
              <div className="flex min-w-0 flex-col gap-1 pt-1">
                <p className="font-semibold text-foreground leading-tight">{plugin.title}</p>
                <p className="text-xs text-muted-foreground">by {plugin.author}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Download className="h-3 w-3" />
                  {fmtDownloads(plugin.downloads)}
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            <VersionPicker projectId={plugin.project_id} onSelect={setSelectedVersion} />

            {installBtn}

            <a
              href={`https://modrinth.com/plugin/${plugin.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              {t("modrinthLink")}
            </a>

            <div className="border-t border-border" />

            <ProjectMetadata detail={detail} members={members} />
          </div>

          {/* Right column — README */}
          <div className="flex-1 overflow-y-auto p-6">
            <Readme body={body} />
          </div>
        </DialogPopup>
      </Dialog>
    );
  }

  /* ── Mobile ── */
  return (
    <>
      <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetPopup side="bottom" showCloseButton>
          <SheetHeader>
            <div className="flex items-center gap-3 pr-8">
              <PluginIcon plugin={plugin} size="sm" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <SheetTitle className="truncate text-base">{plugin.title}</SheetTitle>
                <p className="text-xs text-muted-foreground">by {plugin.author} · <Download className="inline h-2.5 w-2.5" /> {fmtDownloads(plugin.downloads)}</p>
              </div>
            </div>
          </SheetHeader>

          <SheetPanel className="max-h-[65vh]">
            <ProjectMetadata detail={detail} members={members} />
          </SheetPanel>

          <SheetFooter variant="bare">
            <button
              type="button"
              onClick={() => setInstallSheetOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("install")}
            </button>
          </SheetFooter>
        </SheetPopup>
      </Sheet>

      <Sheet open={installSheetOpen} onOpenChange={setInstallSheetOpen}>
        <SheetPopup side="bottom" showCloseButton>
          <SheetHeader>
            <SheetTitle>{t("install")} {plugin.title}</SheetTitle>
          </SheetHeader>
          <SheetPanel scrollFade={false}>
            <VersionPicker projectId={plugin.project_id} onSelect={setSelectedVersion} />
          </SheetPanel>
          <SheetFooter variant="bare">
            {installBtn}
          </SheetFooter>
        </SheetPopup>
      </Sheet>
    </>
  );
}

export default function PluginsPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations("panel.plugins");
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { id } = use(params);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<ModrinthProject[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<ModrinthProject | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  const { data: server } = useQuery(orpc.servers.get.queryOptions({ input: { id } }));

  const eggFeatures = server?.egg?.features
    ? (JSON.parse(server.egg.features) as string[])
    : null;

  const doSearch = useCallback((q: string) => {
    setSearchLoading(true);
    const url = q.trim()
      ? `${MODRINTH_API}/search?query=${encodeURIComponent(q)}&facets=${FACETS}&limit=20`
      : `${MODRINTH_API}/search?facets=${FACETS}&limit=20&index=downloads`;
    fetch(url)
      .then((r) => r.json() as Promise<{ hits: ModrinthProject[] }>)
      .then((data) => setResults(data.hits))
      .catch(() => setResults([]))
      .finally(() => setSearchLoading(false));
  }, []);

  useEffect(() => { doSearch(""); }, [doSearch]);

  function handleQueryChange(val: string) {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(val);
      doSearch(val);
    }, 300);
  }

  if (isPending || !session) return <Loader />;

  if (server && eggFeatures !== null && !eggFeatures.includes("minecraft_plugins")) {
    return (
      <div className="flex flex-1 flex-col bg-background">
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2.5">
          <Puzzle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{t("featuredTitle")}</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Puzzle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-foreground">{t("notSupported")}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("notSupportedHint")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sectionTitle = debouncedQuery.trim() ? t("searchResultsTitle") : t("featuredTitle");

  return (
    <>
      <div className="flex flex-1 flex-col bg-background min-h-0">
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{sectionTitle}</p>

          {searchLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => <PluginCardSkeleton key={i} />)}
            </div>
          ) : results && results.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((plugin) => (
                <PluginCard key={plugin.project_id} plugin={plugin} onClick={() => setSelectedPlugin(plugin)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Puzzle className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("noResults")}</p>
            </div>
          )}
        </div>
      </div>

      {selectedPlugin && (
        <PluginDetail
          plugin={selectedPlugin}
          serverId={id}
          onClose={() => setSelectedPlugin(null)}
        />
      )}
    </>
  );
}
