import { defineNodeInstrumentation } from "evlog/next/instrumentation";

const evlog = defineNodeInstrumentation(() => import("./src/lib/evlog"));

export const onRequestError = evlog.onRequestError;

export async function register() {
  await evlog.register?.();

  // Extensions load only in the Node.js server runtime (not edge), once at boot.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootExtensions } = await import("./src/lib/extensions");
    await bootExtensions();
  }
}
