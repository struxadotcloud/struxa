import { auth } from "@struxav2/auth";
import { createAuthMiddleware, type BetterAuthInstance } from "evlog/better-auth";

import { useLogger } from "@/lib/evlog";

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
  exclude: ["/api/auth/**"],
  maskEmail: true,
});

export async function identifyEvlogUser(request: Request) {
  await identifyUser(useLogger(), request.headers, new URL(request.url).pathname);
}
