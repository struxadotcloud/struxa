"use client";

import { useTranslations } from "next-intl";
import type {
  BackupDestinationInput,
  BackupDestinationType,
} from "@struxa/api/lib/backup-destinations";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@struxa/ui/components/select";
import { Switch } from "@struxa/ui/components/switch";

const TYPE_OPTIONS: BackupDestinationType[] = [
  "wings",
  "ddup_bak",
  "s3",
  "restic",
  "pbs",
  "kopia",
];

export function defaultBackupDestination(
  type: BackupDestinationType,
): BackupDestinationInput {
  switch (type) {
    case "s3":
      return {
        type,
        endpoint: "",
        region: "us-east-1",
        bucket: "",
        accessKey: "",
        secretKey: "",
        usePathStyle: true,
      };
    case "restic":
      return {
        type,
        repository: "",
        password: "",
        retryLockSeconds: 10,
        environment: {},
      };
    case "pbs":
      return {
        type,
        url: "",
        datastore: "",
        namespace: "",
        tokenId: "",
        tokenSecret: "",
        fingerprint: "",
        backupIdPrefix: "",
      };
    case "kopia":
      return {
        type,
        url: "",
        username: "",
        password: "",
        fingerprint: "",
        tags: {},
      };
    default:
      return { type };
  }
}

function inputClass(disabled?: boolean) {
  return `w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring transition-colors${disabled ? " opacity-50 cursor-not-allowed" : ""}`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function kvToText(kv: Record<string, string>): string {
  return Object.entries(kv)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function textToKv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1);
  }
  return out;
}

export function BackupDestinationForm({
  value,
  onChange,
  disabled,
}: {
  value: BackupDestinationInput;
  onChange: (value: BackupDestinationInput) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.backupDestinations");

  return (
    <div className="flex flex-col gap-4">
      <Field label={t("typeLabel")}>
        <Select
          value={value.type}
          onValueChange={(v) => {
            if (v) onChange(defaultBackupDestination(v as BackupDestinationType));
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-[30px] text-sm">
            <SelectValue>
              {value.type === "wings" ? t("typeWings")
                : value.type === "ddup_bak" ? t("typeDdupBak")
                : value.type === "s3" ? t("typeS3")
                : value.type === "restic" ? t("typeRestic")
                : value.type === "pbs" ? t("typePbs")
                : t("typeKopia")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {type === "wings" ? t("typeWings")
                  : type === "ddup_bak" ? t("typeDdupBak")
                  : type === "s3" ? t("typeS3")
                  : type === "restic" ? t("typeRestic")
                  : type === "pbs" ? t("typePbs")
                  : t("typeKopia")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {(value.type === "wings" || value.type === "ddup_bak") && (
        <p className="text-xs text-muted-foreground">{t("localHint")}</p>
      )}

      {value.type === "s3" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("s3EndpointLabel")}>
              <input
                className={inputClass(disabled)}
                placeholder={t("s3EndpointPlaceholder")}
                value={value.endpoint}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, endpoint: e.target.value })}
              />
            </Field>
            <Field label={t("s3RegionLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.region}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, region: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("s3BucketLabel")}>
            <input
              className={inputClass(disabled)}
              placeholder={t("s3BucketPlaceholder")}
              value={value.bucket}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, bucket: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("s3AccessKeyLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.accessKey}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, accessKey: e.target.value })}
              />
            </Field>
            <Field label={t("s3SecretKeyLabel")}>
              <input
                className={inputClass(disabled)}
                type="password"
                value={value.secretKey}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, secretKey: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{t("s3UsePathStyle")}</p>
            <Switch
              checked={value.usePathStyle}
              onCheckedChange={(checked) => onChange({ ...value, usePathStyle: checked })}
              disabled={disabled}
            />
          </div>
        </>
      )}

      {value.type === "restic" && (
        <>
          <Field label={t("resticRepositoryLabel")}>
            <input
              className={inputClass(disabled)}
              placeholder={t("resticRepositoryPlaceholder")}
              value={value.repository}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, repository: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("resticPasswordLabel")}>
              <input
                className={inputClass(disabled)}
                type="password"
                value={value.password}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, password: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <Field label={t("resticRetryLockLabel")}>
              <input
                className={inputClass(disabled)}
                type="number"
                min={0}
                value={value.retryLockSeconds}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ ...value, retryLockSeconds: Number(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
          <Field label={t("resticEnvLabel")}>
            <textarea
              rows={3}
              className={`${inputClass(disabled)} resize-none font-mono text-xs`}
              placeholder={t("resticEnvPlaceholder")}
              value={kvToText(value.environment)}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...value, environment: textToKv(e.target.value) })
              }
            />
          </Field>
        </>
      )}

      {value.type === "pbs" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("pbsUrlLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.url}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, url: e.target.value })}
              />
            </Field>
            <Field label={t("pbsDatastoreLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.datastore}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, datastore: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("pbsNamespaceLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.namespace}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, namespace: e.target.value })}
              />
            </Field>
            <Field label={t("pbsFingerprintLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.fingerprint}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, fingerprint: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("pbsTokenIdLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.tokenId}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, tokenId: e.target.value })}
              />
            </Field>
            <Field label={t("pbsTokenSecretLabel")}>
              <input
                className={inputClass(disabled)}
                type="password"
                value={value.tokenSecret}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, tokenSecret: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <Field label={t("pbsBackupIdPrefixLabel")}>
            <input
              className={inputClass(disabled)}
              value={value.backupIdPrefix}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, backupIdPrefix: e.target.value })}
            />
          </Field>
        </>
      )}

      {value.type === "kopia" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("kopiaUrlLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.url}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, url: e.target.value })}
              />
            </Field>
            <Field label={t("kopiaUsernameLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.username}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, username: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("kopiaPasswordLabel")}>
              <input
                className={inputClass(disabled)}
                type="password"
                value={value.password}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, password: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <Field label={t("kopiaFingerprintLabel")}>
              <input
                className={inputClass(disabled)}
                value={value.fingerprint}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, fingerprint: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("kopiaTagsLabel")}>
            <textarea
              rows={3}
              className={`${inputClass(disabled)} resize-none font-mono text-xs`}
              placeholder={t("kopiaTagsPlaceholder")}
              value={kvToText(value.tags)}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, tags: textToKv(e.target.value) })}
            />
          </Field>
        </>
      )}
    </div>
  );
}
