import type { NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@struxa/env/server";
import { BootstrapError, bootstrapInstaller } from "@struxa/api/services/bootstrap";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255).optional(),
  locationName: z.string().min(1).max(255).optional(),
  wings: z
    .object({
      fqdn: z.string().min(1).max(255),
      nodeName: z.string().min(1).max(255).optional(),
      scheme: z.enum(["https", "http"]).optional(),
      daemonListen: z.number().int().min(1).max(65535).optional(),
      memory: z.number().int().min(1).optional(),
      disk: z.number().int().min(1).optional(),
      uploadSize: z.number().int().min(1).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const secret = env.BOOTSTRAP_SECRET;
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
  if (secret ? req.headers.get("x-bootstrap-secret") !== secret : forwarded) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    return Response.json(await bootstrapInstaller(parsed.data));
  } catch (e) {
    if (e instanceof BootstrapError) {
      return Response.json({ code: e.code, message: e.message }, { status: 409 });
    }
    throw e;
  }
}
