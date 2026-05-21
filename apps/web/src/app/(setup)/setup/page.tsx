"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
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

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ current, completed }: { current: Step; completed: Set<number> }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const isDone = completed.has(s.num);
        const isActive = current === s.num;
        return (
          <div key={s.num} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isDone
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
            }`}>
              {isDone ? <Check className="h-3 w-3" /> : <span>{s.num}</span>}
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function inputClass() {
  return "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      {msg}
    </div>
  );
}

function SuccessBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-600 dark:text-green-400">
      {msg}
    </div>
  );
}

function PrimaryButton({ children, disabled, type = "button", onClick }: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
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
      <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors hover:border-ring data-[popup-open]:border-ring">
        <span>{selected?.label ?? value}</span>
        <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${opt.value === value ? "bg-green-500" : "bg-transparent"}`}
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Create the primary administrator account for this panel. No other users exist yet.
      </p>
      {err && <ErrorBanner msg={err} />}
      <Field label="Display Name (optional)">
        <input className={inputClass()} placeholder="Admin" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </Field>
      <Field label="Email *">
        <input type="email" className={inputClass()} placeholder="admin@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Password *">
          <input type="password" className={inputClass()} placeholder="At least 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </Field>
        <Field label="Confirm Password *">
          <input type="password" className={inputClass()} placeholder="Repeat password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        </Field>
      </div>
      <div className="pt-1">
        <PrimaryButton type="submit" disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? "Creating account..." : "Create Account"}
        </PrimaryButton>
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
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Fetching egg repositories from GitHub...</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading...
        </div>
        <SecondaryButton onClick={onDone}>Skip</SecondaryButton>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner msg="Could not reach GitHub. Check your internet connection or skip this step." />
        <SecondaryButton onClick={onDone}>Skip →</SecondaryButton>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <SuccessBanner msg={`Imported ${result.imported} egg${result.imported !== 1 ? "s" : ""} successfully.`} />
        <PrimaryButton onClick={onDone}>
          <Check className="h-3.5 w-3.5" /> Continue
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Eggs are server configuration templates from the Pterodactyl ecosystem. Select which to import — you can add more later from the admin panel.
      </p>

      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        {repos?.map((repo: RepoResult) => {
          const allEggs = repo.categories.flatMap(c => c.eggs);
          const selectedCount = allEggs.filter(e => selected.has(e.rawUrl)).length;
          const open = expandedRepos.has(repo.id);

          return (
            <div key={repo.id} className="border-b border-border last:border-b-0">
              <div className="flex items-center justify-between px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setExpandedRepos(s => { const n = new Set(s); n.has(repo.id) ? n.delete(repo.id) : n.add(repo.id); return n; })}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
                >
                  {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  {repo.label}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {selectedCount}/{allEggs.length}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleRepo(repo, true)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Select all</button>
                  <button type="button" onClick={() => toggleRepo(repo, false)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">None</button>
                </div>
              </div>

              {open && repo.categories.map(cat => {
                const key = `${repo.id}:${cat.category}`;
                const catOpen = expandedCats.has(key);

                return (
                  <div key={cat.category} className="border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => setExpandedCats(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                      className="flex w-full items-center gap-2 px-5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      {catOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span className="font-mono">{cat.category}</span>
                      <span className="ml-auto text-muted-foreground/60">{cat.eggs.length}</span>
                    </button>
                    {catOpen && cat.eggs.map(egg => (
                      <label key={egg.rawUrl} className="flex cursor-pointer items-center gap-3 py-1.5 pl-10 pr-4 hover:bg-muted/40 transition-colors">
                        <input
                          type="checkbox"
                          className="accent-green-500"
                          checked={selected.has(egg.rawUrl)}
                          onChange={() => toggleEgg(egg, repo.label)}
                        />
                        <span className="text-xs text-foreground">{egg.name}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{selected.size} selected</span>
        <div className="flex items-center gap-2">
          <SecondaryButton onClick={onDone}>Skip</SecondaryButton>
          <PrimaryButton disabled={selected.size === 0 || importMut.isPending} onClick={doImport}>
            {importMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {importMut.isPending ? "Importing..." : `Import ${selected.size} Eggs`}
          </PrimaryButton>
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Locations group your nodes by datacenter or region.
      </p>
      {err && <ErrorBanner msg={err} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *">
          <input className={inputClass()} placeholder="US East" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Short Code *">
          <input className={inputClass()} placeholder="us-east" value={form.short} onChange={e => setForm(f => ({ ...f, short: e.target.value }))} />
        </Field>
      </div>
      <Field label="Description (optional)">
        <input className={inputClass()} placeholder="New York datacenter" value={form.long} onChange={e => setForm(f => ({ ...f, long: e.target.value }))} />
      </Field>
      <div className="pt-1">
        <PrimaryButton type="submit" disabled={create.isPending}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {create.isPending ? "Creating..." : "Create Location"}
        </PrimaryButton>
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Nodes are physical servers running the Wings daemon. You can add more later.
      </p>
      {err && <ErrorBanner msg={err} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Node Name *">
          <input className={inputClass()} placeholder="Node 1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="FQDN *">
          <input className={inputClass()} placeholder="node1.example.com" value={form.fqdn} onChange={e => setForm(f => ({ ...f, fqdn: e.target.value }))} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Scheme">
          <FlatSelect
            value={form.scheme}
            options={[{ value: "https", label: "HTTPS" }, { value: "http", label: "HTTP" }]}
            onChange={v => setForm(f => ({ ...f, scheme: v }))}
          />
        </Field>
        <Field label="Memory (MB) *">
          <input type="number" min={1} className={inputClass()} value={form.memory} onChange={e => setForm(f => ({ ...f, memory: e.target.value }))} />
        </Field>
        <Field label="Disk (MB) *">
          <input type="number" min={1} className={inputClass()} value={form.disk} onChange={e => setForm(f => ({ ...f, disk: e.target.value }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Daemon Port">
          <input type="number" className={inputClass()} value={form.daemonListen} onChange={e => setForm(f => ({ ...f, daemonListen: e.target.value }))} />
        </Field>
        <Field label="SFTP Port">
          <input type="number" className={inputClass()} value={form.daemonSFTP} onChange={e => setForm(f => ({ ...f, daemonSFTP: e.target.value }))} />
        </Field>
      </div>
      <div className="pt-1">
        <PrimaryButton type="submit" disabled={create.isPending}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {create.isPending ? "Creating node..." : "Create Node"}
        </PrimaryButton>
      </div>
    </form>
  );
}

// ─── Step 5: Complete ─────────────────────────────────────────────────────────

function Step5({ onDone, busy, error }: { onDone: () => void; busy: boolean; error: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Your panel is ready. Head to the admin dashboard to create servers and manage your infrastructure.
      </p>
      {error && <ErrorBanner msg={error} />}

      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">What&apos;s Next</p>
        </div>
        {[
          ["Add Allocations", "Assign IP:port pairs to your node before creating servers"],
          ["Create Servers", "Deploy game servers from the admin panel"],
          ["Invite Users", "Add users and assign them servers"],
          ["Configure Settings", "Adjust registration, limits and app branding"],
        ].map(([title, desc]) => (
          <div key={title} className="flex flex-col gap-0.5 border-b border-border px-4 py-3 last:border-b-0">
            <div className="text-sm font-medium text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>

      <div className="pt-1">
        <PrimaryButton disabled={busy} onClick={onDone}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? "Finishing setup..." : "Go to Admin Dashboard"}
        </PrimaryButton>
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
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[600px]">
        {/* Logo */}
        <div className="mb-8">
          <Image src="/logo-dark.svg" alt="Struxa" width={96} height={28} priority className="h-7 w-auto dark:hidden" />
          <Image src="/logo-white.svg" alt="Struxa" width={96} height={28} priority className="hidden h-7 w-auto dark:block" />
        </div>

        {/* Step bar */}
        <div className="mb-6">
          <StepBar current={step} completed={completed} />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {/* Step heading */}
          <div className="mb-5 border-b border-border pb-5">
            <p className="text-xs font-medium text-muted-foreground">Step {step} of {STEPS.length}</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {step === 1 && <Step1 onDone={() => advance(1)} />}
          {step === 2 && <Step2 onDone={() => advance(2)} />}
          {step === 3 && <Step3 onDone={id => { setLocationId(id); advance(3); }} />}
          {step === 4 && <Step4 locationId={locationId} onDone={() => advance(4)} />}
          {step === 5 && <Step5 onDone={finish} busy={finishing} error={finishError} />}
        </div>
      </div>
    </main>
  );
}
