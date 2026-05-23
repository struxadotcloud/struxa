import { getAuth } from "@struxa/auth";
import { createAuthMiddleware, type BetterAuthInstance } from "evlog/better-auth";

import { useLogger } from "@/lib/evlog";

let _middleware: ReturnType<typeof createAuthMiddleware> | null = null;

async function getMiddleware() {
  if (_middleware) return _middleware;
  const auth = await getAuth();
  _middleware = createAuthMiddleware(auth as BetterAuthInstance, {
    exclude: ["/api/auth/**"],
    maskEmail: true,
  });
  return _middleware;
}

export async function identifyEvlogUser(request: Request) {
  const identifyUser = await getMiddleware();
  await identifyUser(useLogger(), request.headers, new URL(request.url).pathname);
}
