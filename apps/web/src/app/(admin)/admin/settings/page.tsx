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
    return general ?? {
      appName: getValue("app_name", "Struxa"),
      appUrl: getValue("app_url"),
    };
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
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#222222] px-4">
          <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
          <Settings2 className="h-4 w-4 text-[#555555]" />
          <span className="text-sm text-white">Settings</span>
        </header>
        <div className="grid grid-cols-1 border-l border-[#222222]">
          <div className="border-r border-b border-[#222222] px-4 py-3 text-sm text-[#555555]">
            Loading...
          </div>
        </div>
      </>
    );
  }

  const gf = generalForm();
  const rf = registrationForm();
  const df = defaultsForm();

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#222222] px-4">
        <SidebarTrigger className="-ml-1 text-[#888888] hover:text-white" />
        <Settings2 className="h-4 w-4 text-[#555555]" />
        <span className="text-sm text-white">Settings</span>
      </header>

      <div className="flex-1 overflow-auto">
        {/* General */}
        <section className="border-b border-[#222222] p-4">
          <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">General</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                App Name
              </label>
              <input
                className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                value={gf.appName}
                onChange={(e) => setGeneral({ ...gf, appName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                App URL
              </label>
              <input
                className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                placeholder="https://panel.example.com"
                value={gf.appUrl}
                onChange={(e) => setGeneral({ ...gf, appUrl: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={saveGeneral}
              disabled={setMutation.isPending}
              className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {saved.includes("general") ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Saved
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </section>

        {/* Registration */}
        <section className="border-b border-[#222222] p-4">
          <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">Registration</p>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white">Allow new user registrations</span>
            <div className="flex gap-2">
              {["true", "false"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setRegistration({ enabled: val })}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    rf.enabled === val
                      ? val === "true"
                        ? "bg-[#22c55e] text-black"
                        : "bg-[#f43f5e] text-white"
                      : "bg-[#222222] text-[#888888] hover:bg-[#2a2a2a]"
                  }`}
                >
                  {val === "true" ? "Enabled" : "Disabled"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={saveRegistration}
              disabled={setMutation.isPending}
              className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {saved.includes("registration") ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Saved
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </section>

        {/* Defaults */}
        <section className="border-b border-[#222222] p-4">
          <p className="mb-3 text-xs uppercase tracking-widest text-[#555555]">
            Default User Limits
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                Max Servers
              </label>
              <input
                type="number"
                min={0}
                className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                value={df.maxServers}
                onChange={(e) => setDefaults({ ...df, maxServers: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                Default Memory (MB)
              </label>
              <input
                type="number"
                min={128}
                className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                value={df.defaultMemory}
                onChange={(e) => setDefaults({ ...df, defaultMemory: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#555555]">
                Default Disk (MB)
              </label>
              <input
                type="number"
                min={512}
                className="border border-[#333333] bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none placeholder:text-[#444444] focus:border-[#555555]"
                value={df.defaultDisk}
                onChange={(e) => setDefaults({ ...df, defaultDisk: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={saveDefaults}
              disabled={setMutation.isPending}
              className="flex items-center gap-1.5 bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {saved.includes("defaults") ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Saved
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
