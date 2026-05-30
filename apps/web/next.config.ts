import "@struxa/env/web";
import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@struxa/extension-sdk"],
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  typedRoutes: true,
  reactCompiler: true,
  // Extension iframe bundles are served from /ext/<id>/ as directory URLs with a
  // trailing slash so their relative asset paths (./bundle.js) resolve. Keep
  // Next from redirecting those slashes away.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "**" }],
  },
};

export default withNextIntl(nextConfig);
