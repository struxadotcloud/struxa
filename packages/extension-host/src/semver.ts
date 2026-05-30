/**
 * Minimal semver range check — just enough to validate an extension's
 * `struxaApi` declaration against the host version without pulling in a
 * dependency. Supports: "*", exact "x.y.z", and caret "^x.y.z".
 */

function parse(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function satisfies(range: string, version: string): boolean {
  const r = range.trim();
  if (r === "*") return true;

  const ver = parse(version);
  if (!ver) return false;

  if (r.startsWith("^")) {
    const base = parse(r.slice(1));
    if (!base) return false;
    const [bMaj, bMin, bPatch] = base;
    const [maj, min, patch] = ver;
    if (maj !== bMaj) return false;
    // For ^, allow >= base within the same major.
    if (min < bMin) return false;
    if (min === bMin && patch < bPatch) return false;
    return true;
  }

  const exact = parse(r);
  if (!exact) return false;
  return exact[0] === ver[0] && exact[1] === ver[1] && exact[2] === ver[2];
}
