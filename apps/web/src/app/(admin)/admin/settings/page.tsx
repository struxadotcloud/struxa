"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SidebarTrigger } from "@struxa/ui/components/sidebar";
import { Settings2, Check } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";

function invalidateSettings() {
  void queryClient.invalidateQueries({ queryKey: orpc.settings.key() });
}

type SavedKey = string;

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function inputClass() {
  return "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors";
}

export default function AdminSettingsPage() {
  const { data: allSettings, isLoading } = useQuery(orpc.settings.getAll.queryOptions());
  const setMutation = useMutation(
    orpc.settings.set.mutationOptions({ onSuccess: invalidateSettings }),
  );
  const [saved, setSaved] = useState<SavedKey[]>([]);

  function getValue(key: string, fallback = "") {
    return allSettings?.[key] ?? fallback;
  }

  const [general, setGeneral] = useState<{ appName: string; appUrl: string } | null>(null);
  const [registration, setRegistration] = useState<{ enabled: string } | null>(null);
  const [defaults, setDefaults] = useState<{
    maxServers: string;
    defaultMemory: string;
    defaultDisk: string;
  } | null>(null);

  function generalForm() {
    return general ?? { appName: getValue("app_name", "Struxa"), appUrl: getValue("app_url") };
  }
  function registrationForm() {
    return registration ?? { enabled: getValue("registration_enabled", "true") };
  }
  function defaultsForm() {
    return defaults ?? {
      maxServers: getValue("default_max_servers", "10"),
      defaultMemory: getValue("default_memory_mb", "1024"),
      defaultDisk: getValue("default_disk_mb", "10240"),
    };
  }

  async function saveGeneral() {
    const f = generalForm();
    await Promise.all([
      setMutation.mutateAsync({ key: "app_name", value: f.appName }),
      setMutation.mutateAsync({ key: "app_url", value: f.appUrl }),
    ]);
    setSaved((s) => [...s, "general"]);
    setTimeout(() => setSaved((s) => s.filter((k) => k !== "general")), 2000);
  }

  async function saveRegistration() {
    const f = registrationForm();
    await setMutation.mutateAsync({ key: "registration_enabled", value: f.enabled });
    setSaved((s) => [...s, "registration"]);
    setTimeout(() => setSaved((s) => s.filter((k) => k !== "registration")), 2000);
  }

  async function saveDefaults() {
    const f = defaultsForm();
    await Promise.all([
      setMutation.mutateAsync({ key: "default_max_servers", value: f.maxServers }),
      setMutation.mutateAsync({ key: "default_memory_mb", value: f.defaultMemory }),
      setMutation.mutateAsync({ key: "default_disk_mb", value: f.defaultDisk }),
    ]);
    setSaved((s) => [...s, "defaults"]);
    setTimeout(() => setSaved((s) => s.filter((k) => k !== "defaults")), 2000);
  }

  if (isLoading) {
    return (
      <>
        <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border bg-card px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Settings</span>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  const gf = generalForm();
  const rf = registrationForm();
  const df = defaultsForm();

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border bg-card px-4">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Settings</span>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl flex flex-col gap-4">
          <SectionCard title="General">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">App Name</label>
                <input
                  className={inputClass()}
                  value={gf.appName}
                  onChange={(e) => setGeneral({ ...gf, appName: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">App URL</label>
                <input
                  className={inputClass()}
                  placeholder="https://panel.example.com"
                  value={gf.appUrl}
                  onChange={(e) => setGeneral({ ...gf, appUrl: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={saveGeneral}
                disabled={setMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {saved.includes("general") ? (
                  <><Check className="h-3.5 w-3.5" /> Saved</>
                ) : "Save"}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Registration">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Allow new user registrations</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When disabled, only admins can create new accounts.
                </p>
              </div>
              <div className="flex gap-2">
                {["true", "false"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setRegistration({ enabled: val })}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      rf.enabled === val
                        ? val === "true"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30"
                          : "bg-destructive/10 text-destructive border border-destructive/30"
                        : "bg-muted text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    {val === "true" ? "Enabled" : "Disabled"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={saveRegistration}
                disabled={setMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {saved.includes("registration") ? (
                  <><Check className="h-3.5 w-3.5" /> Saved</>
                ) : "Save"}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Default User Limits">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Max Servers</label>
                <input
                  type="number"
                  min={0}
                  className={inputClass()}
                  value={df.maxServers}
                  onChange={(e) => setDefaults({ ...df, maxServers: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Default Memory (MB)</label>
                <input
                  type="number"
                  min={128}
                  className={inputClass()}
                  value={df.defaultMemory}
                  onChange={(e) => setDefaults({ ...df, defaultMemory: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Default Disk (MB)</label>
                <input
                  type="number"
                  min={512}
                  className={inputClass()}
                  value={df.defaultDisk}
                  onChange={(e) => setDefaults({ ...df, defaultDisk: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={saveDefaults}
                disabled={setMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {saved.includes("defaults") ? (
                  <><Check className="h-3.5 w-3.5" /> Saved</>
                ) : "Save"}
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
