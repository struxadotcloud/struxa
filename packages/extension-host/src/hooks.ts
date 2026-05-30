import type { HookEvent } from "@struxa/extension-sdk";
import type { HookPayloads } from "@struxa/extension-sdk/server";

/**
 * Typed, in-process event bus. Core service code calls {@link emit} at
 * meaningful points; extensions subscribe through their capability-scoped
 * `ctx.hooks.on(...)`, which delegates here after gating on the `hook:<event>`
 * permission.
 *
 * v1 semantics: "after/notify" only. Handlers are fire-and-forget; a throwing
 * or slow handler is isolated (logged, never awaited by core) so an extension
 * can never break or stall a core flow. "before"/mutating hooks are a later
 * phase.
 */

type AnyPayload = Record<string, unknown>;
type Handler = (payload: AnyPayload) => void | Promise<void>;

interface Subscription {
  extId: string;
  handler: Handler;
}

const subscriptions = new Map<string, Subscription[]>();

/** Subscribe a handler to an event on behalf of an extension. */
export function subscribe(extId: string, event: string, handler: Handler): void {
  const list = subscriptions.get(event) ?? [];
  list.push({ extId, handler });
  subscriptions.set(event, list);
}

/** Drop all subscriptions owned by an extension (on disable/uninstall/reload). */
export function unsubscribeExtension(extId: string): void {
  for (const [event, list] of subscriptions) {
    const next = list.filter((s) => s.extId !== extId);
    if (next.length) subscriptions.set(event, next);
    else subscriptions.delete(event);
  }
}

/**
 * Fire an event. Returns immediately; handlers run detached. Errors are caught
 * per-handler and reported, never propagated to the caller.
 */
export function emit<E extends HookEvent>(
  event: E,
  payload: E extends keyof HookPayloads ? HookPayloads[E] : AnyPayload,
): void {
  const list = subscriptions.get(event);
  if (!list?.length) return;
  for (const sub of list) {
    void (async () => {
      try {
        await sub.handler(payload as AnyPayload);
      } catch (err) {
        console.error(
          `[extensions] hook handler failed (ext=${sub.extId}, event=${event}):`,
          err,
        );
      }
    })();
  }
}
