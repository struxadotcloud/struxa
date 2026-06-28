"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Search, Package, ExternalLink, Download, Puzzle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import Loader from "@/components/loader";
import {
  Sheet,
  SheetPopup,
  SheetHeader,
  SheetTitle,
  SheetPanel,
  SheetFooter,
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
  follows: number;
  categories: string[];
  versions: string[];
  date_modified: string;
  latest_version: string;
  license: string;
  project_type: string;
}

interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  loaders: string[];
  game_versions: string[];
  date_published: string;
  files: {
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }[];
}

const MODRINTH_API = "https://api.modrinth.com/v2";
const PLUGIN_LOADERS = ["paper", "spigot", "bukkit", "purpur", "folia"];
const FACETS = encodeURIComponent(JSON.stringify([["project_type:plugin"]]));

function fmtDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
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

function PluginCard({
  plugin,
  onClick,
}: {
  plugin: ModrinthProject;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center">
          {plugin.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={plugin.icon_url}
              alt={plugin.title}
              className="h-12 w-12 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Puzzle className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <p className="truncate text-sm font-semibold text-foreground leading-tight">
            {plugin.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">by {plugin.author}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
          <Download className="h-3 w-3" />
          {fmtDownloads(plugin.downloads)}
        </div>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {plugin.description}
      </p>
      {plugin.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {plugin.categories.slice(0, 3).map((cat) => (
            <span
              key={cat}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
            >
              {cat}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function VersionSelect({
  projectId,
  selectedVersionId,
  onSelect,
}: {
  projectId: string;
  selectedVersionId: string | null;
  onSelect: (v: ModrinthVersion | null) => void;
}) {
  const t = useTranslations("panel.plugins");
  const [versions, setVersions] = useState<ModrinthVersion[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setVersions(null);
    onSelect(null);
    fetch(`${MODRINTH_API}/project/${projectId}/version`)
      .then((r) => r.json() as Promise<ModrinthVersion[]>)
      .then((all) => {
        const filtered = all.filter(
          (v) => v.loaders.length === 0 || v.loaders.some((l) => PLUGIN_LOADERS.includes(l)),
        );
        setVersions(filtered.length > 0 ? filtered : all);
        if (filtered.length > 0) onSelect(filtered[0] ?? null);
        else if (all.length > 0) onSelect(all[0] ?? null);
      })
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
    // onSelect is intentionally omitted — it's a stable callback from parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground animate-pulse">{t("loadingVersions")}</p>
    );
  }
  if (!versions || versions.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("noVersions")}</p>;
  }

  return (
    <Select
      value={selectedVersionId ?? ""}
      onValueChange={(val) => onSelect(versions.find((v) => v.id === val) ?? null)}
    >
      <SelectTrigger className="h-9 text-xs">
        <SelectValue placeholder={t("selectVersion")} />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            {v.version_number}
            {v.game_versions.length > 0 ? ` — ${v.game_versions[0]}` : ""}
            {v.loaders.length > 0 ? ` (${v.loaders[0]})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const [selectedVersion, setSelectedVersion] = useState<ModrinthVersion | null>(null);
  const [installing, setInstalling] = useState(false);

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

  return (
    <>
      <SheetHeader>
        <div className="flex items-start gap-4 pr-8">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
            {plugin.icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={plugin.icon_url}
                alt={plugin.title}
                className="h-14 w-14 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Puzzle className="h-7 w-7 text-muted-foreground" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <SheetTitle className="truncate">{plugin.title}</SheetTitle>
            <p className="text-sm text-muted-foreground">by {plugin.author}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Download className="h-3 w-3" />
              {fmtDownloads(plugin.downloads)} downloads
            </div>
          </div>
        </div>
      </SheetHeader>

      <SheetPanel>
        <div className="flex flex-col gap-5">
          <a
            href={`https://modrinth.com/plugin/${plugin.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t("modrinthLink")}
          </a>

          <p className="text-sm leading-relaxed text-foreground">{plugin.description}</p>

          {plugin.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {plugin.categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground capitalize"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">{t("versionLabel")}</p>
            <VersionSelect
              projectId={plugin.project_id}
              selectedVersionId={selectedVersion?.id ?? null}
              onSelect={setSelectedVersion}
            />
          </div>
        </div>
      </SheetPanel>

      <SheetFooter>
        <button
          type="button"
          onClick={install}
          disabled={!selectedVersion || installing}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {installing ? t("installing") : t("install")}
        </button>
      </SheetFooter>
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
  const isSupported = !server || eggFeatures === null || eggFeatures.includes("minecraft_plugins");

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

  useEffect(() => {
    doSearch("");
  }, [doSearch]);

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
          <Package className="h-4 w-4 text-muted-foreground" />
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
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {sectionTitle}
          </p>

          {searchLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <PluginCardSkeleton key={i} />
              ))}
            </div>
          ) : results && results.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((plugin) => (
                <PluginCard
                  key={plugin.project_id}
                  plugin={plugin}
                  onClick={() => setSelectedPlugin(plugin)}
                />
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

      <Sheet open={!!selectedPlugin} onOpenChange={(open) => { if (!open) setSelectedPlugin(null); }}>
        <SheetPopup side="right">
          {selectedPlugin && (
            <PluginDetail
              plugin={selectedPlugin}
              serverId={id}
              onClose={() => setSelectedPlugin(null)}
            />
          )}
        </SheetPopup>
      </Sheet>
    </>
  );
}
