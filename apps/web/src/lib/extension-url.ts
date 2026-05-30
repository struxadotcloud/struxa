/**
 * Builds the iframe `src` for an extension asset. Paths that look like a
 * directory (no file extension) get a trailing slash so the bundle's relative
 * asset references (e.g. `./bundle.js`) resolve against the right base URL.
 */
export function extensionFrameSrc(extId: string, rel: string): string {
  let src = `/ext/${extId}/${rel}`;
  if (!/\.[a-z0-9]+$/i.test(src)) src = src.replace(/\/?$/, "/");
  return src;
}
