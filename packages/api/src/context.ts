import { auth } from "@struxa/auth";
import type { NextRequest } from "next/server";

export async function createContext(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  return {
    auth: null,
    session,
    ip,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
