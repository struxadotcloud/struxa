import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@struxa/env/server";
import { manifestSchema, type Manifest } from "@struxa/extension-sdk";
import * as tar from "tar";

import { extensionDir } from "./loader";

/**
 * Marketplace installer: talks to the extension registry, verifies package
 * signatures, and extracts approved packages into EXTENSIONS_DIR. Extraction and
 * verification happen here (the boot loader assumes packages already on disk).
 *
 * Registry protocol (documented contract):
 *   GET {REGISTRY_URL}/index.json
 *     -> { extensions: RegistryEntry[] }
 *   Each entry's `tarball` is a URL to a gzipped tar of the package; `signature`
 *   is a base64 ed25519 signature over the tarball bytes, verified against
 *   EXTENSIONS_REGISTRY_PUBLIC_KEY (base64 SPKI DER).
 */

export interface RegistryEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  readme?: string;
  permissions: string[];
  tarball: string;
  signature: string;
}

function registryUrl(): string {
  const url = env.EXTENSIONS_REGISTRY_URL;
  if (!url) throw new Error("EXTENSIONS_REGISTRY_URL is not configured");
  return url.replace(/\/$/, "");
}

/** Fetch the marketplace catalog. */
export async function listAvailableExtensions(): Promise<RegistryEntry[]> {
  const res = await fetch(`${registryUrl()}/index.json`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`registry index fetch failed: ${res.status}`);
  }
  const body = (await res.json()) as { extensions?: RegistryEntry[] };
  return body.extensions ?? [];
}

function verifySignature(data: Uint8Array, signatureB64: string): void {
  const pub = env.EXTENSIONS_REGISTRY_PUBLIC_KEY;
  if (!pub) throw new Error("EXTENSIONS_REGISTRY_PUBLIC_KEY is not configured");
  const key = createPublicKey({
    key: Buffer.from(pub, "base64"),
    format: "der",
    type: "spki",
  });
  const ok = cryptoVerify(null, data, key, Buffer.from(signatureB64, "base64"));
  if (!ok) throw new Error("package signature verification failed");
}

async function resolveUrl(maybeRelative: string): Promise<string> {
  return /^https?:\/\//.test(maybeRelative)
    ? maybeRelative
    : `${registryUrl()}/${maybeRelative.replace(/^\//, "")}`;
}

/**
 * Download, verify, and extract a registry package to disk. Returns the parsed
 * manifest. Does not enable the extension or grant permissions — that is the
 * admin's explicit follow-up step.
 */
export async function installExtension(entry: RegistryEntry): Promise<Manifest> {
  const tarballUrl = await resolveUrl(entry.tarball);
  const res = await fetch(tarballUrl);
  if (!res.ok) throw new Error(`package download failed: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  verifySignature(bytes, entry.signature);

  const dir = extensionDir(entry.id, entry.version);
  // Clean any partial prior install, then extract fresh.
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const tmp = path.join(dir, ".package.tgz");
  await writeFile(tmp, bytes);
  try {
    await tar.x({ file: tmp, cwd: dir });
  } finally {
    await rm(tmp, { force: true });
  }

  // Validate the extracted manifest and sanity-check identity.
  const { readFile } = await import("node:fs/promises");
  const manifestRaw = await readFile(path.join(dir, "manifest.json"), "utf8");
  const manifest = manifestSchema.parse(JSON.parse(manifestRaw));
  if (manifest.id !== entry.id || manifest.version !== entry.version) {
    await rm(dir, { recursive: true, force: true });
    throw new Error("manifest id/version does not match registry entry");
  }
  return manifest;
}

/** Remove an installed package's files from disk. */
export async function uninstallExtensionFiles(
  id: string,
  version: string,
): Promise<void> {
  await rm(extensionDir(id, version), { recursive: true, force: true });
}
