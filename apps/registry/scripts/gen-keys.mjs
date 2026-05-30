import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Generates the ed25519 keypair the registry uses to sign packages.
 * Run this once when setting up a new registry.
 *
 * Outputs:
 *   keys/registry_private.pem      — local signing key (gitignored, never share)
 *   keys/registry_private.pem.b64  — base64-encoded PEM for use as a CI secret
 *   keys/registry_public.b64       — public key for EXTENSIONS_REGISTRY_PUBLIC_KEY
 */
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const keysDir = path.join(root, "keys");
mkdirSync(keysDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
const privB64 = Buffer.from(privPem).toString("base64");
const pubSpkiB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

writeFileSync(path.join(keysDir, "registry_private.pem"), privPem);
writeFileSync(path.join(keysDir, "registry_private.pem.b64"), privB64 + "\n");
writeFileSync(path.join(keysDir, "registry_public.b64"), pubSpkiB64 + "\n");

console.log("Generated keys/registry_private.pem\n");
console.log("── GitHub Actions secret ──────────────────────────────────────────");
console.log("Name:  REGISTRY_PRIVATE_KEY");
console.log("Value: (contents of keys/registry_private.pem.b64)");
console.log("");
console.log("── Struxa instance env var ────────────────────────────────────────");
console.log(`EXTENSIONS_REGISTRY_PUBLIC_KEY=${pubSpkiB64}`);
console.log("");
console.log("Both keys/registry_private.pem and keys/registry_private.pem.b64 are gitignored.");
