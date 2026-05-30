import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as tar from "tar";

/**
 * Builds the registry output from packages/:
 *   1. Discovers every subdirectory of packages/ as an extension.
 *   2. Packs each into a signed gzip tarball under dist/tarballs/.
 *   3. Writes dist/index.json — the catalog the Struxa host fetches.
 *
 * dist/ is never committed; CI deploys it to GitHub Pages via actions/deploy-pages.
 *
 * Key source (first match wins):
 *   REGISTRY_PRIVATE_KEY env var — base64-encoded PKCS8 PEM (GitHub Actions secret)
 *   keys/registry_private.pem    — raw PEM file (local dev)
 */
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(root, "packages");
const distDir = path.join(root, "dist");
const tarballsDir = path.join(distDir, "tarballs");

// --- load signing key ---
let privateKey;
if (process.env.REGISTRY_PRIVATE_KEY) {
  const pem = Buffer.from(process.env.REGISTRY_PRIVATE_KEY, "base64").toString("utf8");
  privateKey = createPrivateKey(pem);
} else {
  const privPath = path.join(root, "keys", "registry_private.pem");
  if (!existsSync(privPath)) {
    console.error("No signing key found.");
    console.error("  Local:  run `npm run gen-keys` to create keys/registry_private.pem");
    console.error("  CI:     set REGISTRY_PRIVATE_KEY secret (base64 PEM from gen-keys output)");
    process.exit(1);
  }
  privateKey = createPrivateKey(readFileSync(privPath));
}

// --- discover packages ---
if (!existsSync(packagesDir)) {
  console.error("packages/ directory not found.");
  process.exit(1);
}
const packageDirs = readdirSync(packagesDir)
  .map((name) => path.join(packagesDir, name))
  .filter((p) => statSync(p).isDirectory());

if (packageDirs.length === 0) {
  console.warn("No packages found in packages/ — nothing to build.");
  process.exit(0);
}

// What gets shipped in each tarball. Source files, node_modules, etc. are excluded.
const PACK_ALLOWLIST = [
  "manifest.json",
  "package.json",
  "README.md",
  "server",
  "web",
  "migrations",
  "messages",
  "icon.svg",
];

rmSync(distDir, { recursive: true, force: true });
mkdirSync(tarballsDir, { recursive: true });

const entries = [];

for (const dir of packageDirs) {
  // Submodule-style extensions build their output to dist/; legacy packages are flat.
  const pkgRoot = existsSync(path.join(dir, "dist", "manifest.json"))
    ? path.join(dir, "dist")
    : dir;

  const manifestPath = path.join(pkgRoot, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.warn(`  skip ${path.basename(dir)} — no manifest.json`);
    continue;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const tarName = `${manifest.id}-${manifest.version}.tgz`;
  const tarPath = path.join(tarballsDir, tarName);
  const include = PACK_ALLOWLIST.filter((f) => existsSync(path.join(pkgRoot, f)));

  await tar.c({ gzip: true, file: tarPath, cwd: pkgRoot }, include);

  const bytes = readFileSync(tarPath);
  const signature = cryptoSign(null, bytes, privateKey).toString("base64");

  // README may live in the repo root (submodule) or next to manifest.json
  const readmePath = existsSync(path.join(dir, "README.md"))
    ? path.join(dir, "README.md")
    : path.join(pkgRoot, "README.md");
  const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : undefined;

  entries.push({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description ?? "",
    author: manifest.author ?? "",
    permissions: manifest.permissions ?? [],
    readme,
    tarball: `tarballs/${tarName}`,
    signature,
  });

  console.log(`  packed + signed  ${manifest.id}@${manifest.version}  (${bytes.length} bytes)`);
}

writeFileSync(
  path.join(distDir, "index.json"),
  JSON.stringify({ extensions: entries }, null, 2) + "\n",
);

console.log(`\nBuilt dist/ with ${entries.length} extension(s).`);
