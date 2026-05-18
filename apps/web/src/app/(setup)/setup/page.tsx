"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@struxa/ui/components/dropdown-menu";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";

// ─── Step order ───────────────────────────────────────────────────────────────
// 1. Admin Account
// 2. Import Eggs
// 3. Location
// 4. Node
// 5. Complete

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { num: Step; label: string }[] = [
  { num: 1, label: "Admin Account" },
  { num: 2, label: "Import Eggs" },
  { num: 3, label: "Location" },
  { num: 4, label: "Node" },
  { num: 5, label: "Complete" },
];

// ─── Header step bar ──────────────────────────────────────────────────────────

function StepBar({ current, completed }: { current: Step; completed: Set<number> }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const isDone = completed.has(s.num);
        const isActive = current === s.num;
        return (
          <div key={s.num} className="flex items-center gap-0">
            <span
              className={`px-2 text-[10px] uppercase tracking-wider ${
                isDone
                  ? "text-[#22c55e]"
                  : isActive
                    ? "text-white"
                    : "text-[#333333]"
              }`}
            >
              {isDone ? "✓" : s.num}&nbsp;{s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-[#2a2a2a]">/</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared input style ───────────────────────────────────────────────────────

const input =
  "w-full border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none placeholder:text-[#3a3a3a] focus:border-[#555555]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] uppercase tracking-wider text-[#555555]">{label}</label>
      {children}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="border-l-2 border-[#f43f5e] bg-[#f43f5e]/5 px-3 py-2 text-xs text-[#f43f5e]">
      {msg}
    </div>
  );
}

function FlatSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center justify-between border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-white outline-none transition-colors hover:border-[#555555] data-[popup-open]:border-[#555555]">
        <span>{selected?.label ?? value}</span>
        <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-[#555555]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={2}
        className="border border-[#222222] bg-[#0d0d0d] p-0 shadow-xl"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-[#888888] focus:bg-[#1a1a1a] focus:text-white"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${opt.value === value ? "bg-[#22c55e]" : "bg-transparent"}`}
            />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Step 1: Admin Account ────────────────────────────────────────────────────

function Step1({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const promote = useMutation(orpc.onboarding.promoteFirstAdmin.mutationOptions());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.email) return setErr("Email is required.");
    if (form.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setErr("Passwords do not match.");
    setBusy(true);
    try {
      const { error: signUpErr } = await authClient.signUp.email({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || form.email.trim(),
      });
      if (signUpErr) throw new Error(signUpErr.message ?? "Account creation failed.");
      const { error: signInErr } = await authClient.signIn.email({
        email: form.email.trim(),
        password: form.password,
      });
      if (signInErr) throw new Error(signInErr.message ?? "Sign in failed.");
      await promote.mutateAsync(undefined);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-0">
      <div className="border-b border-[#1a1a1a] py-4">
        <p className="text-xs text-[#555555]">
          Create the primary administrator account for this panel. No other users exist yet.
        </p>
      </div>

      {err && (
        <div className="border-b border-[#1a1a1a] py-4">
          <ErrorBanner msg={err} />
        </div>
      )}

      <div className="border-b border-[#1a1a1a] py-4">
        <Field label="Display Name (optional)">
          <input className={input} placeholder="Admin" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
      </div>

      <div className="border-b border-[#1a1a1a] py-4">
        <Field label="Email *">
          <input type="email" className={input} placeholder="admin@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-[#1a1a1a] py-4">
        <Field label="Password *">
          <input type="password" className={input} placeholder="At least 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </Field>
        <Field label="Confirm Password *">
          <input type="password" className={input} placeholder="Repeat password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        </Field>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-2 bg-white px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? "Creating account..." : "Create Account →"}
        </button>
      </div>
    </form>
  );
}

// ─── Step 2: Import Eggs ──────────────────────────────────────────────────────

type EggEntry = { name: string; path: string; rawUrl: string };
type RepoResult = { id: string; label: string; categories: { category: string; eggs: EggEntry[] }[] };

function Step2({ onDone }: { onDone: () => void }) {
  const { data: repos, isLoading, isError } = useQuery(
    orpc.onboarding.listEggRepositories.queryOptions(),
  );
  const importMut = useMutation(orpc.onboarding.importEggs.mutationOptions());

  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set(["game-eggs"]));
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ imported: number } | null>(null);

  function toggleEgg(egg: EggEntry, nest: string) {
    setSelected(prev => {
      const n = new Map(prev);
      n.has(egg.rawUrl) ? n.delete(egg.rawUrl) : n.set(egg.rawUrl, nest);
      return n;
    });
  }

  function toggleRepo(repo: RepoResult, on: boolean) {
    setSelected(prev => {
      const n = new Map(prev);
      for (const c of repo.categories) {
        for (const e of c.eggs) on ? n.set(e.rawUrl, repo.label) : n.delete(e.rawUrl);
      }
      return n;
    });
  }

  async function doImport() {
    const eggs = Array.from(selected.entries()).map(([rawUrl, nestName]) => ({ rawUrl, nestName }));
    const r = await importMut.mutateAsync({ eggs });
    setResult(r);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-0">
        <div className="border-b border-[#1a1a1a] py-4">
          <p className="text-xs text-[#555555]">Fetching egg repositories from GitHub...</p>
        </div>
        <div className="flex items-center gap-2 py-6 text-xs text-[#555555]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading...
        </div>
        <div className="pt-2">
          <button onClick={onDone} className="bg-neutral-800 px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80">
            Skip →
          </button>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-0">
        <div className="border-b border-[#1a1a1a] py-4">
          <ErrorBanner msg="Could not reach GitHub. Check your internet connection or skip this step." />
        </div>
        <div className="pt-4">
          <button onClick={onDone} className="bg-neutral-800 px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80">
            Skip →
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col gap-0">
        <div className="border-b border-[#1a1a1a] py-4">
          <div className="border-l-2 border-[#22c55e] bg-[#22c55e]/5 px-3 py-2 text-xs text-[#22c55e]">
            Imported {result.imported} egg{result.imported !== 1 ? "s" : ""} successfully.
          </div>
        </div>
        <div className="pt-4">
          <button onClick={onDone} className="flex items-center gap-2 bg-white px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-80">
            <Check className="h-3.5 w-3.5" /> Continue →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="border-b border-[#1a1a1a] py-4">
        <p className="text-xs text-[#555555]">
          Eggs are server configuration templates from the Pterodactyl ecosystem. Select which to import — you can add more later from the admin panel.
        </p>
      </div>

      {/* Repo list */}
      <div className="border-b border-[#1a1a1a] py-2">
        {repos?.map((repo: RepoResult) => {
          const allEggs = repo.categories.flatMap(c => c.eggs);
          const selectedCount = allEggs.filter(e => selected.has(e.rawUrl)).length;
          const open = expandedRepos.has(repo.id);

          return (
            <div key={repo.id} className="border-b border-[#1a1a1a] last:border-b-0">
              {/* Repo row */}
              <div className="flex items-center justify-between py-2">
                <button
                  type="button"
                  onClick={() => setExpandedRepos(s => { const n = new Set(s); n.has(repo.id) ? n.delete(repo.id) : n.add(repo.id); return n; })}
                  className="flex items-center gap-2 text-xs text-white hover:text-[#888888] transition-colors"
                >
                  {open ? <ChevronDown className="h-3 w-3 text-[#444444]" /> : <ChevronRight className="h-3 w-3 text-[#444444]" />}
                  <span className="uppercase tracking-wider">{repo.label}</span>
                  <span className="text-[#444444]">{selectedCount}/{allEggs.length}</span>
                </button>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => toggleRepo(repo, true)} className="text-[10px] text-[#555555] hover:text-white transition-colors">Select all</button>
                  <button type="button" onClick={() => toggleRepo(repo, false)} className="text-[10px] text-[#555555] hover:text-white transition-colors">None</button>
                </div>
              </div>

              {open && repo.categories.map(cat => {
                const key = `${repo.id}:${cat.category}`;
                const catOpen = expandedCats.has(key);

                return (
                  <div key={cat.category}>
                    <button
                      type="button"
                      onClick={() => setExpandedCats(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                      className="flex w-full items-center gap-2 px-4 py-1.5 text-[11px] text-[#666666] hover:text-white transition-colors"
                    >
                      {catOpen ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                      <span className="font-mono text-[#888888]">{cat.category}</span>
                      <span className="ml-auto text-[#333333]">{cat.eggs.length}</span>
                    </button>
                    {catOpen && cat.eggs.map(egg => (
                      <label key={egg.rawUrl} className="flex cursor-pointer items-center gap-3 py-1 pl-8 pr-4 hover:bg-[#0f0f0f]">
                        <input
                          type="checkbox"
                          className="accent-[#22c55e]"
                          checked={selected.has(egg.rawUrl)}
                          onChange={() => toggleEgg(egg, repo.label)}
                        />
                        <span className="text-xs text-[#cccccc]">{egg.name}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4">
        <span className="text-[10px] text-[#444444]">{selected.size} selected</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDone} className="bg-neutral-800 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80">
            Skip
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || importMut.isPending}
            onClick={doImport}
            className="flex items-center gap-2 bg-white px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {importMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {importMut.isPending ? "Importing..." : `Import ${selected.size} Eggs →`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Location ─────────────────────────────────────────────────────────

function Step3({ onDone }: { onDone: (id: string) => void }) {
  const [form, setForm] = useState({ name: "", short: "", long: "" });
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation(orpc.locations.create.mutationOptions());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.name.trim() || !form.short.trim()) return setErr("Name and short code are required.");
    try {
      const r = await create.mutateAsync(form);
      if (r?.id) onDone(r.id);
    } catch {
      setErr("Failed to create location.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-0">
      <div className="border-b border-[#1a1a1a] py-4">
        <p className="text-xs text-[#555555]">
          Locations group your nodes by datacenter or region.
        </p>
      </div>
      {err && <div className="border-b border-[#1a1a1a] py-4"><ErrorBanner msg={err} /></div>}
      <div className="grid grid-cols-2 gap-4 border-b border-[#1a1a1a] py-4">
        <Field label="Name *">
          <input className={input} placeholder="US East" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Short Code *">
          <input className={input} placeholder="us-east" value={form.short} onChange={e => setForm(f => ({ ...f, short: e.target.value }))} />
        </Field>
      </div>
      <div className="border-b border-[#1a1a1a] py-4">
        <Field label="Description (optional)">
          <input className={input} placeholder="New York datacenter" value={form.long} onChange={e => setForm(f => ({ ...f, long: e.target.value }))} />
        </Field>
      </div>
      <div className="pt-4">
        <button type="submit" disabled={create.isPending} className="flex items-center gap-2 bg-white px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40">
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {create.isPending ? "Creating..." : "Create Location →"}
        </button>
      </div>
    </form>
  );
}

// ─── Step 4: Node ─────────────────────────────────────────────────────────────

function Step4({ locationId, onDone }: { locationId: string; onDone: () => void }) {
  const [form, setForm] = useState({
    name: "", fqdn: "", scheme: "https" as "https" | "http",
    memory: "4096", disk: "50000", daemonListen: "8080", daemonSFTP: "2022",
  });
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation(orpc.nodes.create.mutationOptions());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.name.trim() || !form.fqdn.trim()) return setErr("Name and FQDN are required.");
    const memory = parseInt(form.memory, 10);
    const disk = parseInt(form.disk, 10);
    if (!memory || memory < 1) return setErr("Memory must be a positive integer.");
    if (!disk || disk < 1) return setErr("Disk must be a positive integer.");
    try {
      await create.mutateAsync({
        name: form.name.trim(), fqdn: form.fqdn.trim(), locationId,
        scheme: form.scheme, memory, disk,
        daemonListen: parseInt(form.daemonListen, 10) || 8080,
        daemonSFTP: parseInt(form.daemonSFTP, 10) || 2022,
      });
      onDone();
    } catch {
      setErr("Failed to create node.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-0">
      <div className="border-b border-[#1a1a1a] py-4">
        <p className="text-xs text-[#555555]">
          Nodes are physical servers running the Wings daemon. You can add more later.
        </p>
      </div>
      {err && <div className="border-b border-[#1a1a1a] py-4"><ErrorBanner msg={err} /></div>}
      <div className="grid grid-cols-2 gap-4 border-b border-[#1a1a1a] py-4">
        <Field label="Node Name *">
          <input className={input} placeholder="Node 1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="FQDN *">
          <input className={input} placeholder="node1.example.com" value={form.fqdn} onChange={e => setForm(f => ({ ...f, fqdn: e.target.value }))} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4 border-b border-[#1a1a1a] py-4">
        <Field label="Scheme">
          <FlatSelect
            value={form.scheme}
            options={[{ value: "https", label: "HTTPS" }, { value: "http", label: "HTTP" }]}
            onChange={v => setForm(f => ({ ...f, scheme: v }))}
          />
        </Field>
        <Field label="Memory (MB) *">
          <input type="number" min={1} className={input} value={form.memory} onChange={e => setForm(f => ({ ...f, memory: e.target.value }))} />
        </Field>
        <Field label="Disk (MB) *">
          <input type="number" min={1} className={input} value={form.disk} onChange={e => setForm(f => ({ ...f, disk: e.target.value }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 border-b border-[#1a1a1a] py-4">
        <Field label="Daemon Port">
          <input type="number" className={input} value={form.daemonListen} onChange={e => setForm(f => ({ ...f, daemonListen: e.target.value }))} />
        </Field>
        <Field label="SFTP Port">
          <input type="number" className={input} value={form.daemonSFTP} onChange={e => setForm(f => ({ ...f, daemonSFTP: e.target.value }))} />
        </Field>
      </div>
      <div className="pt-4">
        <button type="submit" disabled={create.isPending} className="flex items-center gap-2 bg-white px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40">
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {create.isPending ? "Creating node..." : "Create Node →"}
        </button>
      </div>
    </form>
  );
}

// ─── Step 5: Complete ─────────────────────────────────────────────────────────

function Step5({ onDone, busy, error }: { onDone: () => void; busy: boolean; error: string | null }) {
  return (
    <div className="flex flex-col gap-0">
      <div className="border-b border-[#1a1a1a] py-4">
        <p className="text-xs text-[#555555]">
          Your panel is ready. Head to the admin dashboard to create servers and manage your infrastructure.
        </p>
      </div>
      {error && (
        <div className="border-b border-[#1a1a1a] py-4">
          <ErrorBanner msg={error} />
        </div>
      )}

      <div className="border-b border-[#1a1a1a] py-4">
        <p className="mb-3 text-[10px] uppercase tracking-widest text-[#555555]">What's Next</p>
        <div className="flex flex-col">
          {[
            ["Add Allocations", "Assign IP:port pairs to your node before creating servers"],
            ["Create Servers", "Deploy game servers from the admin panel"],
            ["Invite Users", "Add users and assign them servers"],
            ["Configure Settings", "Adjust registration, limits and app branding"],
          ].map(([title, desc]) => (
            <div key={title} className="border-b border-[#1a1a1a] py-3 last:border-b-0">
              <div className="text-sm text-white">{title}</div>
              <div className="mt-0.5 text-[11px] text-[#555555]">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4">
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="flex items-center gap-2 bg-white px-5 py-2 text-sm font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? "Finishing setup..." : "Go to Admin Dashboard →"}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [locationId, setLocationId] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const complete = useMutation(orpc.onboarding.completeSetup.mutationOptions());

  function advance(s: number) {
    setCompleted(prev => new Set([...prev, s]));
    setStep((s + 1) as Step);
  }

  async function finish() {
    setFinishing(true);
    setFinishError(null);
    try {
      await complete.mutateAsync(undefined);
      // Hard navigation so the server layouts re-run without any router cache
      window.location.href = "/admin";
    } catch (e) {
      setFinishError(e instanceof Error ? e.message : "Failed to complete setup. Please try again.");
      setFinishing(false);
    }
  }

  const TITLES: Record<Step, [string, string]> = {
    1: ["Create Admin Account", "Set up the primary administrator account."],
    2: ["Import Eggs", "Choose server templates to import from the Pterodactyl repositories."],
    3: ["Register a Location", "Define where your nodes are physically located."],
    4: ["Add a Node", "Connect your first Wings daemon."],
    5: ["Setup Complete", "Everything is configured and ready to use."],
  };

  const [title, subtitle] = TITLES[step];

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#0a0a0a] px-4 py-10">
      <div className="w-full max-w-[600px]">
        {/* Step bar */}
        <div className="mb-6 border-b border-[#1e1e1e] pb-4">
          <StepBar current={step} completed={completed} />
        </div>

        {/* Step heading */}
        <div className="mb-1 border-b border-[#1a1a1a] pb-4">
          <h2 className="text-[10px] uppercase tracking-widest text-[#555555]">
            Step {step} of {STEPS.length}
          </h2>
          <p className="mt-1 text-lg font-semibold text-white">{title}</p>
          <p className="mt-0.5 text-xs text-[#555555]">{subtitle}</p>
        </div>

        {step === 1 && <Step1 onDone={() => advance(1)} />}
        {step === 2 && <Step2 onDone={() => advance(2)} />}
        {step === 3 && <Step3 onDone={id => { setLocationId(id); advance(3); }} />}
        {step === 4 && <Step4 locationId={locationId} onDone={() => advance(4)} />}
        {step === 5 && <Step5 onDone={finish} busy={finishing} error={finishError} />}
      </div>
    </main>
  );
}
