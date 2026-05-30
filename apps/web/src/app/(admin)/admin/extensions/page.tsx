"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Boxes, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 12;

type InstalledRow = {
  id: string;
  version: string;
  manifest: { name?: string; permissions?: string[]; description?: string; author?: string };
  grantedPermissions: string[];
  enabled: boolean;
  status: string;
  lastError: string | null;
  runtimeStatus: string | null;
};

type AvailableEntry = {
  id: string;
  version: string;
  name: string;
  description?: string;
  author?: string;
  tarball: string;
};

function idToHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return h % 360;
}

function ExtAvatar({ id, name, iconUrl }: { id: string; name: string; iconUrl?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const hue = idToHue(id);
  const letter = (name[0] ?? id[0] ?? "?").toUpperCase();

  if (iconUrl && !imgFailed) {
    return (
      <img
        src={iconUrl}
        alt={name}
        onError={() => setImgFailed(true)}
        className="h-14 w-14 rounded-2xl object-cover"
      />
    );
  }

  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold text-white"
      style={{ background: `hsl(${hue} 55% 45%)` }}
    >
      {letter}
    </div>
  );
}

function Pagination({
  page,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("extensions");
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-muted-foreground">
        {t("pageOf", { page, total })}
      </span>
      <div className="flex gap-1">
        <button
          disabled={page <= 1}
          onClick={onPrev}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          disabled={page >= total}
          onClick={onNext}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
      style={{ background: "#1D9BF0" }}
    >
      <Check className="h-2 w-2 text-white" strokeWidth={3} />
    </span>
  );
}

export default function ExtensionsPage() {
  const t = useTranslations("extensions");
  const tc = useTranslations("common");

  const [tab, setTab] = useState<"discover" | "installed">("discover");
  const [discoverPage, setDiscoverPage] = useState(1);
  const [installedPage, setInstalledPage] = useState(1);

  const { data: installed, isLoading: installedLoading } = useQuery(
    orpc.extensions.listInstalled.queryOptions(),
  );
  const { data: available, isLoading: availableLoading } = useQuery(
    orpc.extensions.listAvailable.queryOptions(),
  );

  const installedRows = (installed ?? []) as InstalledRow[];
  const installedIds = new Set(installedRows.map((r) => r.id));
  const marketplace = ((available ?? []) as AvailableEntry[]).filter(
    (e) => !installedIds.has(e.id),
  );

  const discoverTotalPages = Math.max(1, Math.ceil(marketplace.length / PAGE_SIZE));
  const installedTotalPages = Math.max(1, Math.ceil(installedRows.length / PAGE_SIZE));
  const discoverSlice = marketplace.slice(
    (discoverPage - 1) * PAGE_SIZE,
    discoverPage * PAGE_SIZE,
  );
  const installedSlice = installedRows.slice(
    (installedPage - 1) * PAGE_SIZE,
    installedPage * PAGE_SIZE,
  );

  const tabs = [
    { key: "discover", label: t("tabDiscover") },
    { key: "installed", label: `${t("tabInstalled")}${installedRows.length ? ` (${installedRows.length})` : ""}` },
  ] as const;

  return (
    <div className="flex-1 overflow-auto px-6 py-5">
      <div className="mx-auto flex flex-col gap-4 max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-foreground">{t("title")}</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border -mb-1">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === tb.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Discover tab */}
        {tab === "discover" && (
          <div className="flex flex-col gap-4">
            {availableLoading ? (
              <p className="text-sm text-muted-foreground">{tc("loading")}</p>
            ) : discoverSlice.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <Boxes className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">{t("noneAvailable")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {discoverSlice.map((e) => (
                  <div
                    key={`${e.id}@${e.version}`}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <ExtAvatar id={e.id} name={e.name} iconUrl={`/ext/${e.id}/icon.svg`} />
                    <div className="flex flex-col gap-0.5">
                      <p className="truncate text-sm font-semibold text-foreground">{e.name}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">v{e.version}</span>
                        {e.author && (
                          <>
                            <span className="text-[11px] text-muted-foreground/50">·</span>
                            <span className="text-[11px] text-muted-foreground">{e.author}</span>
                            {e.author.toLowerCase() === "struxa" && <VerifiedBadge />}
                          </>
                        )}
                      </div>
                    </div>
                    <p className="line-clamp-3 flex-1 text-xs text-muted-foreground">
                      {e.description ?? t("noDescription")}
                    </p>
                    <Link
                      href={`/admin/extensions/${e.id}` as never}
                      className="flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Details
                    </Link>
                  </div>
                ))}
              </div>
            )}
            <Pagination
              page={discoverPage}
              total={discoverTotalPages}
              onPrev={() => setDiscoverPage((p) => p - 1)}
              onNext={() => setDiscoverPage((p) => p + 1)}
            />
          </div>
        )}

        {/* Installed tab */}
        {tab === "installed" && (
          <div className="flex flex-col gap-4">
            {installedLoading ? (
              <p className="text-sm text-muted-foreground">{tc("loading")}</p>
            ) : installedSlice.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <Boxes className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">{t("noneInstalled")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("tabDiscover")} extensions from the Discover tab.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {installedSlice.map((row) => {
                  const name = row.manifest.name ?? row.id;
                  return (
                    <div
                      key={row.id}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                    >
                      <ExtAvatar id={row.id} name={name} iconUrl={`/ext/${row.id}/icon.svg`} />
                      <div className="flex flex-col gap-0.5">
                        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">v{row.version}</span>
                          {row.manifest.author && (
                            <>
                              <span className="text-[11px] text-muted-foreground/50">·</span>
                              <span className="text-[11px] text-muted-foreground">{row.manifest.author}</span>
                              {row.manifest.author.toLowerCase() === "struxa" && <VerifiedBadge />}
                            </>
                          )}
                        </div>
                        {(row.runtimeStatus === "errored" || (row.enabled && row.runtimeStatus === "active")) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {row.runtimeStatus === "errored" && (
                              <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                                {t("errored")}
                              </span>
                            )}
                            {row.enabled && row.runtimeStatus === "active" && (
                              <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                                {t("active")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {row.lastError ? (
                        <p className="line-clamp-3 flex-1 text-xs text-destructive">{row.lastError}</p>
                      ) : (
                        <p className="line-clamp-3 flex-1 text-xs text-muted-foreground">
                          {row.manifest.description ?? t("noDescription")}
                        </p>
                      )}
                      <Link
                        href={`/admin/extensions/${row.id}` as never}
                        className="flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        Details
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
            <Pagination
              page={installedPage}
              total={installedTotalPages}
              onPrev={() => setInstalledPage((p) => p - 1)}
              onNext={() => setInstalledPage((p) => p + 1)}
            />
          </div>
        )}

      </div>
    </div>
  );
}
