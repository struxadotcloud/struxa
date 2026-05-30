# Struxa Extension Registry (reference)

Distribution-only marketplace for Struxa extensions. It takes **already-built**
extension packages, signs them (ed25519), and serves the catalog (`index.json`)
that a Struxa instance pulls from on install. It does **not** build extensions —
each extension is its own project that bundles itself (plain HTML, React,
anything) down to the package contract.

## Layout

```
registry.config.json    paths to built package dirs to publish
scripts/gen-keys.mjs     generate the ed25519 signing keypair
scripts/build.mjs        pack + sign each configured package, write public/index.json
server.mjs               static server for public/
keys/                    generated (gitignored) — holds the private key
public/                  generated (gitignored) — what gets served
```

Example extensions live as sibling projects, e.g. `../hello` (vanilla) and
`../react-demo` (React). Build them in their own dirs first.

## Usage

```bash
npm install
npm run gen-keys     # writes keys/, prints EXTENSIONS_REGISTRY_PUBLIC_KEY

# build the extensions you want to publish (in their own projects), e.g.:
( cd ../react-demo && npm install && npm run build )

npm run build        # pack + sign everything in registry.config.json
npm start            # serve http://localhost:4000  (PORT to override)
```

## registry.config.json

```jsonc
{
  "packages": [
    "../hello",            // a built package dir (vanilla: source == package)
    "../react-demo/dist"   // a built package dir (React: build output)
  ]
}
```

Each path must contain a ready-to-ship package: `manifest.json` + `server/` +
`web/` + optional `migrations/` / `messages/`. Source and node_modules are never
packed (only an allowlist is).

## Wire it into Struxa

Set on the Struxa web container:

```
EXTENSIONS_REGISTRY_URL=http://<reachable-address>:4000
EXTENSIONS_REGISTRY_PUBLIC_KEY=<value printed by gen-keys>
```

In dev, `http://localhost:4000` works (app runs on the host). In Docker, use an
address the container can reach (e.g. `http://host.docker.internal:4000`).

Then: **Admin → Extensions → Marketplace → Install → approve permissions → Enable**.

## Package signature

Per package, `build.mjs` writes an `index.json` entry with `tarball` (relative
path) and `signature` (base64 ed25519 over the tarball bytes). The host verifies
it against `EXTENSIONS_REGISTRY_PUBLIC_KEY` before extracting.
