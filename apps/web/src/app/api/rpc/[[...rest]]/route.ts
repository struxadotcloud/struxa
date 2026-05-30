import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@struxa/api/context";
import { createFullRouter } from "@struxa/api/routers/index";
import { extensionRegistry } from "@struxa/extension-host";
import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { INSTANCE_SETTINGS_TAG } from "@/lib/instance-settings";
import { bootExtensions } from "@/lib/extensions";

import { withEvlog } from "@/lib/evlog";
import { identifyEvlogUser } from "@/lib/evlog-auth";

type Handlers = {
  rpcHandler: RPCHandler<Awaited<ReturnType<typeof createContext>>>;
  apiHandler: OpenAPIHandler<Awaited<ReturnType<typeof createContext>>>;
};

let handlers: Handlers | null = null;

function buildHandlers(): Handlers {
  const router = createFullRouter();
  return {
    rpcHandler: new RPCHandler(router, {
      interceptors: [onError((error) => console.error(error))],
    }),
    apiHandler: new OpenAPIHandler(router, {
      plugins: [
        new OpenAPIReferencePlugin({
          schemaConverters: [new ZodToJsonSchemaConverter()],
        }),
      ],
      interceptors: [onError((error) => console.error(error))],
    }),
  };
}

// Rebuild handlers whenever the set of active extensions changes (install,
// enable/disable, reload) so `ext.<id>.*` routes stay in sync without a restart.
extensionRegistry.onChange(() => {
  handlers = null;
});

async function getHandlers(): Promise<Handlers> {
  // Idempotent: ensures extensions are loaded before the first request is served
  // (instrumentation also triggers this on boot).
  await bootExtensions();
  if (!handlers) handlers = buildHandlers();
  return handlers;
}

async function handleRequest(req: NextRequest) {
  await identifyEvlogUser(req);
  const { rpcHandler, apiHandler } = await getHandlers();
  const ctx = await createContext(req);
  ctx.revalidate = () => revalidateTag(INSTANCE_SETTINGS_TAG, {});
  const rpcResult = await rpcHandler.handle(req, {
    prefix: "/api/rpc",
    context: ctx,
  });
  if (rpcResult.response) return rpcResult.response;

  const apiResult = await apiHandler.handle(req, {
    prefix: "/api/rpc/api-reference",
    context: ctx,
  });
  if (apiResult.response) return apiResult.response;

  return new Response("Not found", { status: 404 });
}

export const GET = withEvlog(handleRequest);
export const POST = withEvlog(handleRequest);
export const PUT = withEvlog(handleRequest);
export const PATCH = withEvlog(handleRequest);
export const DELETE = withEvlog(handleRequest);
