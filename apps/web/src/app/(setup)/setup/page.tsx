"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
import { syncLocaleFromDB } from "@/lib/sync-locale";

// ─── Step order ───────────────────────────────────────────────────────────────
// 1. Admin Account
// 2. Import Eggs
// 3. Location
// 4. Node
// 5. Complete

type Step = 1 | 2 | 3 | 4 | 5;

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ current, completed, labels }: { current: Step; completed: Set<number>; labels: string[] }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        {labels.map((label, i) => {
          const num = (i + 1) as Step;
          const isDone = completed.has(num);
          const isActive = current === num;
          return (
            <div key={num} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isDone
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
              }`}>
                {isDone ? <Check className="h-3 w-3" /> : <span>{num}</span>}
                {label}
              </div>
              {i < labels.length - 1 && (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              )}
            </div>
          );
        })}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-foreground"
          initial={false}
          animate={{ width: `${(current / labels.length) * 100}%` }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function inputClass() {
  return "h-8.5 w-full rounded-lg border border-input bg-background px-[calc(--spacing(3)-1px)] text-base leading-8.5 text-foreground outline-none shadow-xs/5 transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 sm:h-7.5 sm:text-sm sm:leading-7.5";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-destructive/36 bg-destructive/4 px-3 py-2 text-xs text-destructive">
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
      className="flex h-9 items-center gap-2 rounded-lg border border-primary bg-primary px-[calc(--spacing(3)-1px)] text-sm font-medium text-primary-foreground shadow-xs shadow-primary/25 transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-64 sm:h-8"
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
      className="flex h-9 items-center rounded-lg border border-input bg-popover px-[calc(--spacing(3)-1px)] text-sm font-medium text-foreground shadow-xs/5 transition-colors hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-64 sm:h-8"
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
      <DropdownMenuTrigger className="flex h-8.5 w-full items-center justify-between rounded-lg border border-input bg-background px-[calc(--spacing(3)-1px)] text-sm text-foreground outline-none shadow-xs/5 transition-shadow hover:border-ring data-[popup-open]:border-ring data-[popup-open]:ring-[3px] data-[popup-open]:ring-ring/25 sm:h-7.5">
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
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${opt.value === value ? "bg-primary" : "bg-transparent"}`}
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
  const t = useTranslations("setup.step1");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const promote = useMutation(orpc.onboarding.promoteFirstAdmin.mutationOptions({ meta: { customError: true } }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.email) return setErr(t("emailRequired"));
    if (form.password.length < 8) return setErr(t("passwordMinLength"));
    if (form.password !== form.confirm) return setErr(t("passwordsDoNotMatch"));
    setBusy(true);
    try {
      const { error: signUpErr } = await authClient.signUp.email({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim() || form.email.trim(),
      });
      if (signUpErr) throw new Error(signUpErr.message ?? t("creationFailed"));
      const { error: signInErr } = await authClient.signIn.email({
        email: form.email.trim(),
        password: form.password,
      });
      if (signInErr) throw new Error(signInErr.message ?? t("signInFailed"));
      await promote.mutateAsync(undefined);
      await syncLocaleFromDB();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {err && <ErrorBanner msg={err} />}
      <Field label={t("displayNameLabel")}>
        <input className={inputClass()} placeholder={t("displayNamePlaceholder")} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </Field>
      <Field label={t("emailLabel")}>
        <input type="email" className={inputClass()} placeholder={t("emailPlaceholder")} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("passwordLabel")}>
          <input type="password" className={inputClass()} placeholder={t("passwordPlaceholder")} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </Field>
        <Field label={t("confirmPasswordLabel")}>
          <input type="password" className={inputClass()} placeholder={t("confirmPasswordPlaceholder")} value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        </Field>
      </div>
      <div className="pt-1">
        <PrimaryButton type="submit" disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? t("submitting") : t("submit")}
        </PrimaryButton>
      </div>
    </form>
  );
}

// ─── Step 2: Import Eggs ──────────────────────────────────────────────────────

type EggEntry = { name: string; path: string; rawUrl: string };
type RepoResult = { id: string; label: string; categories: { category: string; eggs: EggEntry[] }[] };

function Step2({ onDone }: { onDone: () => void }) {
  const t = useTranslations("setup.step2");
  const ts = useTranslations("setup");
  const { data: repos, isLoading, isError } = useQuery(
    orpc.onboarding.listEggRepositories.queryOptions(),
  );
  const importMut = useMutation(orpc.onboarding.importEggs.mutationOptions());

  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set(["game-eggs"]));
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: { name: string; reason: string }[] } | null>(null);
  const q = search.trim().toLowerCase();

  const SKIP_REASONS: Record<string, string> = {
    download: t("skippedDownload"),
    parse: t("skippedParse"),
    save: t("skippedSave"),
  };

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
    toast.success(ts("importSuccess", { count: r.imported }));
    if (r.skipped.length > 0) toast.warning(ts("skippedToast", { count: r.skipped.length }));
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("fetching")}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("loading")}
        </div>
        <SecondaryButton onClick={onDone}>{t("skip")}</SecondaryButton>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner msg={t("networkError")} />
        <SecondaryButton onClick={onDone}>{t("skip")} →</SecondaryButton>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{ts("importSuccess", { count: result.imported })}</p>
        {result.skipped.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
            <p className="text-xs font-medium text-warning-foreground">{t("skippedTitle", { count: result.skipped.length })}</p>
            <ul className="mt-1.5 max-h-36 space-y-1 overflow-y-auto pr-1">
              {result.skipped.map((s, i) => (
                <li key={`${s.name}-${i}`} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate text-foreground">{s.name}</span>
                  <span className="shrink-0 text-muted-foreground">{SKIP_REASONS[s.reason] ?? t("skippedParse")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <PrimaryButton onClick={onDone}>
          <Check className="h-3.5 w-3.5" /> Continue
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("description")}</p>

      <input className={inputClass()} placeholder={t("searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />

      <div className="max-h-[45vh] overflow-y-auto overscroll-contain rounded-xl border border-border bg-muted/20">
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
                  <button type="button" onClick={() => toggleRepo(repo, true)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">{t("selectAll")}</button>
                  <button type="button" onClick={() => toggleRepo(repo, false)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">{t("none")}</button>
                </div>
              </div>

              {open && repo.categories.map(cat => {
                const key = `${repo.id}:${cat.category}`;
                const catOpen = expandedCats.has(key);
                const eggs = q ? cat.eggs.filter(e => e.name.toLowerCase().includes(q)) : cat.eggs;
                if (eggs.length === 0) return null;
                const showEggs = catOpen || Boolean(q);

                return (
                  <div key={cat.category} className="border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => setExpandedCats(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                      className="flex w-full items-center gap-2 px-5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      {catOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span className="font-mono">{cat.category}</span>
                      <span className="ml-auto text-muted-foreground/60">{eggs.length}</span>
                    </button>
                    {showEggs && eggs.map(egg => (
                      <label key={egg.rawUrl} className="flex cursor-pointer items-center gap-3 py-1.5 pl-10 pr-4 hover:bg-muted/40 transition-colors">
                        <input
                          type="checkbox"
                          className="accent-primary"
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
        <span className="text-xs text-muted-foreground">{t("selected", { count: selected.size })}</span>
        <div className="flex items-center gap-2">
          <SecondaryButton onClick={onDone}>{t("skip")}</SecondaryButton>
          <PrimaryButton disabled={selected.size === 0 || importMut.isPending} onClick={doImport}>
            {importMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {importMut.isPending ? t("importing") : t("import", { count: selected.size })}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Location ─────────────────────────────────────────────────────────

function Step3({ onDone }: { onDone: (id: string) => void }) {
  const t = useTranslations("setup.step3");
  const [form, setForm] = useState({ name: "", short: "", long: "" });
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation(orpc.locations.create.mutationOptions({ meta: { customError: true } }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.name.trim() || !form.short.trim()) return setErr(t("nameShortCodeRequired"));
    try {
      const r = await create.mutateAsync(form);
      if (r?.id) onDone(r.id);
    } catch {
      toast.error(t("createFailed"));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {err && <ErrorBanner msg={err} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("nameLabel")}>
          <input className={inputClass()} placeholder={t("namePlaceholder")} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label={t("shortCodeLabel")}>
          <input className={inputClass()} placeholder={t("shortCodePlaceholder")} value={form.short} onChange={e => setForm(f => ({ ...f, short: e.target.value }))} />
        </Field>
      </div>
      <Field label={t("descriptionLabel")}>
        <input className={inputClass()} placeholder={t("descriptionPlaceholder")} value={form.long} onChange={e => setForm(f => ({ ...f, long: e.target.value }))} />
      </Field>
      <div className="pt-1">
        <PrimaryButton type="submit" disabled={create.isPending}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {create.isPending ? t("creating") : t("submit")}
        </PrimaryButton>
      </div>
    </form>
  );
}

// ─── Step 4: Node ─────────────────────────────────────────────────────────────

function Step4({ locationId, onDone }: { locationId: string; onDone: () => void }) {
  const t = useTranslations("setup.step4");
  const [form, setForm] = useState({
    name: "", fqdn: "", scheme: "https" as "https" | "http",
    memory: "4096", disk: "50000", daemonListen: "8080", daemonSFTP: "2022",
  });
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation(orpc.nodes.create.mutationOptions({ meta: { customError: true } }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.name.trim() || !form.fqdn.trim()) return setErr(t("nameAndFqdnRequired"));
    const memory = parseInt(form.memory, 10);
    const disk = parseInt(form.disk, 10);
    if (!memory || memory < 1) return setErr(t("memoryInvalid"));
    if (!disk || disk < 1) return setErr(t("diskInvalid"));
    try {
      await create.mutateAsync({
        name: form.name.trim(), fqdn: form.fqdn.trim(), locationId,
        scheme: form.scheme, memory, disk,
        daemonListen: parseInt(form.daemonListen, 10) || 8080,
        daemonSFTP: parseInt(form.daemonSFTP, 10) || 2022,
      });
      onDone();
    } catch {
      toast.error(t("createFailed"));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {err && <ErrorBanner msg={err} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("nodeNameLabel")}>
          <input className={inputClass()} placeholder={t("nodeNamePlaceholder")} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label={t("fqdnLabel")}>
          <input className={inputClass()} placeholder={t("fqdnPlaceholder")} value={form.fqdn} onChange={e => setForm(f => ({ ...f, fqdn: e.target.value }))} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("schemeLabel")}>
          <FlatSelect
            value={form.scheme}
            options={[{ value: "https", label: "HTTPS" }, { value: "http", label: "HTTP" }]}
            onChange={v => setForm(f => ({ ...f, scheme: v }))}
          />
        </Field>
        <Field label={t("memoryLabel")}>
          <input type="number" min={1} className={inputClass()} value={form.memory} onChange={e => setForm(f => ({ ...f, memory: e.target.value }))} />
        </Field>
        <Field label={t("diskLabel")}>
          <input type="number" min={1} className={inputClass()} value={form.disk} onChange={e => setForm(f => ({ ...f, disk: e.target.value }))} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("daemonPortLabel")}>
          <input type="number" className={inputClass()} value={form.daemonListen} onChange={e => setForm(f => ({ ...f, daemonListen: e.target.value }))} />
        </Field>
        <Field label={t("sftpPortLabel")}>
          <input type="number" className={inputClass()} value={form.daemonSFTP} onChange={e => setForm(f => ({ ...f, daemonSFTP: e.target.value }))} />
        </Field>
      </div>
      <div className="pt-1">
        <PrimaryButton type="submit" disabled={create.isPending}>
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {create.isPending ? t("creating") : t("submit")}
        </PrimaryButton>
      </div>
    </form>
  );
}

// ─── Step 5: Complete ─────────────────────────────────────────────────────────

function Step5({ onDone, busy }: { onDone: () => void; busy: boolean }) {
  const t = useTranslations("setup.step5");

  const NEXT_ITEMS = [
    [t("addAllocations"), t("addAllocationsDesc")],
    [t("createServers"), t("createServersDesc")],
    [t("inviteUsers"), t("inviteUsersDesc")],
    [t("configureSettings"), t("configureSettingsDesc")],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("description")}</p>

      <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{t("whatsNext")}</p>
        </div>
        {NEXT_ITEMS.map(([title, desc]) => (
          <div key={title} className="flex flex-col gap-0.5 border-b border-border px-4 py-3 last:border-b-0">
            <div className="text-sm font-medium text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        ))}
      </div>

      <div className="pt-1">
        <PrimaryButton disabled={busy} onClick={onDone}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {busy ? t("finishing") : t("submit")}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const t = useTranslations("setup");
  const ta = useTranslations("auth.social");
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [locationId, setLocationId] = useState("");
  const [finishing, setFinishing] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const complete = useMutation(orpc.onboarding.completeSetup.mutationOptions({ meta: { customError: true } }));

  function advance(s: number) {
    setCompleted(prev => new Set([...prev, s]));
    setStep((s + 1) as Step);
  }

  async function finish() {
    setFinishing(true);
    try {
      await complete.mutateAsync(undefined);
      window.location.href = "/admin";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("step5.finishFailed"));
      setFinishing(false);
    }
  }

  const STEP_LABELS = [
    t("steps.adminAccount"),
    t("steps.importEggs"),
    t("steps.location"),
    t("steps.node"),
    t("steps.complete"),
  ];

  const TITLES: Record<Step, [string, string]> = {
    1: [t("step1.title"), t("step1.subtitle")],
    2: [t("step2.title"), t("step2.subtitle")],
    3: [t("step3.title"), t("step3.subtitle")],
    4: [t("step4.title"), t("step4.subtitle")],
    5: [t("step5.title"), t("step5.subtitle")],
  };

  const [title, subtitle] = TITLES[step];

  return (
    <main className="min-h-svh bg-background lg:grid lg:grid-cols-2">
      {/* Branding panel — desktop only */}
      <div className="relative hidden lg:flex lg:flex-col lg:justify-between lg:items-start lg:order-1 bg-muted/40 border-border px-12 py-10 border-r">
        <Image src="/logo-dark.svg" alt="Struxa" width={96} height={28} priority className="h-7 w-auto dark:hidden" />
        <Image src="/logo-white.svg" alt="Struxa" width={96} height={28} priority className="hidden h-7 w-auto dark:block" />
        <div className="flex flex-col gap-2 items-start text-left">
          <p className="text-2xl font-semibold tracking-tight text-foreground">Struxa</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            {ta("tagline")}
          </p>
        </div>
        <p className="text-xs text-muted-foreground/60">© {new Date().getFullYear()} Struxa</p>
      </div>

      {/* Wizard panel */}
      <div className="flex min-h-svh flex-col items-center justify-center px-4 py-10 lg:min-h-0 lg:py-16 lg:order-2">
        <div className="flex w-full max-w-xl flex-col gap-6">
          {/* Logo shown only on mobile */}
          <div className="flex justify-center lg:hidden">
            <Image src="/logo-dark.svg" alt="Struxa" width={96} height={28} priority className="h-7 w-auto dark:hidden" />
            <Image src="/logo-white.svg" alt="Struxa" width={96} height={28} priority className="hidden h-7 w-auto dark:block" />
          </div>

          <StepBar current={step} completed={completed} labels={STEP_LABELS} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
            >
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-5 border-b border-border pb-5">
                  <p className="text-xs font-medium text-muted-foreground">{t("stepOf", { step, total: STEP_LABELS.length })}</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
                </div>

                {step === 1 && <Step1 onDone={() => advance(1)} />}
                {step === 2 && <Step2 onDone={() => advance(2)} />}
                {step === 3 && <Step3 onDone={id => { setLocationId(id); advance(3); }} />}
                {step === 4 && <Step4 locationId={locationId} onDone={() => advance(4)} />}
                {step === 5 && <Step5 onDone={finish} busy={finishing} />}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
