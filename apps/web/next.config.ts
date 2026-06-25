import "@struxa/env/web";
import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  typedRoutes: true,
  reactCompiler: true,
  images: {
    remotePatterns: [],
  },
  allowedDevOrigins: ["tunnel.strikx.dev"],
};

export default withNextIntl(nextConfig);
