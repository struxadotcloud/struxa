import { randomUUID } from "crypto";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@struxa/db";
import { eggVariables, eggs, nests, settings, user } from "@struxa/db";
import { adminProcedure, protectedProcedure, publicProcedure } from "../index";

async function isSetupDone(): Promise<boolean> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, "setup_complete"),
  });
  return row?.value === "true";
}

export const onboardingRouter = {
  isSetupRequired: publicProcedure.handler(async () => {
    return !(await isSetupDone());
  }),

  promoteFirstAdmin: protectedProcedure.handler(async ({ context }) => {
    if (await isSetupDone()) {
      throw new Error("Setup is already complete.");
    }
    const [{ total }] = await db.select({ total: count() }).from(user);
    if (total !== 1) {
      throw new Error("Unexpected number of users.");
    }
    await db
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, context.session.user.id));
  }),

  listEggRepositories: publicProcedure.handler(async () => {
    type EggEntry = { name: string; path: string; rawUrl: string };
    type RepoResult = {
      id: string;
      label: string;
      categories: { category: string; eggs: EggEntry[] }[];
    };

    const repos = [
      { id: "game-eggs", label: "Game Eggs", owner: "pterodactyl", repo: "game-eggs" },
      {
        id: "application-eggs",
        label: "Application Eggs",
        owner: "pterodactyl",
        repo: "application-eggs",
      },
      { id: "generic-eggs", label: "Generic Eggs", owner: "pterodactyl", repo: "generic-eggs" },
    ];

    const results = await Promise.allSettled(
      repos.map(async ({ id, label, owner, repo }): Promise<RepoResult> => {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
          { headers: { Accept: "application/vnd.github+json" } },
        );
        if (!res.ok) return { id, label, categories: [] };

        const data = (await res.json()) as { tree: { path: string; type: string }[] };
        const jsonFiles = data.tree.filter(
          (item) =>
            item.type === "blob" &&
            item.path.endsWith(".json") &&
            !item.path.includes("README") &&
            !item.path.toLowerCase().includes("package.json"),
        );

        const categoryMap = new Map<string, EggEntry[]>();

        for (const file of jsonFiles) {
          const parts = file.path.split("/");
          if (parts.length < 2) continue;
          const category = parts.slice(0, -1).join(" / ");
          const name = parts[parts.length - 1]
            .replace(/\.json$/, "")
            .replace(/^egg[-_]/, "")
            .replace(/[-_]/g, " ");
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${file.path}`;

          if (!categoryMap.has(category)) categoryMap.set(category, []);
          categoryMap.get(category)!.push({ name, path: file.path, rawUrl });
        }

        const categories = Array.from(categoryMap.entries()).map(([category, eggList]) => ({
          category,
          eggs: eggList,
        }));

        return { id, label, categories };
      }),
    );

    return (results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<RepoResult>[]).map(
      (r) => r.value,
    );
  }),

  importEggs: adminProcedure
    .input(
      z.object({
        eggs: z.array(
          z.object({
            nestName: z.string().min(1).max(255),
            rawUrl: z.string().url(),
          }),
        ),
      }),
    )
    .handler(async ({ input }) => {
      const nestCache = new Map<string, string>();
      let imported = 0;

      async function getOrCreateNest(name: string): Promise<string> {
        if (nestCache.has(name)) return nestCache.get(name)!;

        const existing = await db.query.nests.findFirst({
          where: eq(nests.name, name),
        });
        if (existing) {
          nestCache.set(name, existing.id);
          return existing.id;
        }

        const id = randomUUID();
        await db.insert(nests).values({
          id,
          uuid: randomUUID(),
          name,
          description: null,
          author: "onboarding-import",
        });
        nestCache.set(name, id);
        return id;
      }

      for (const item of input.eggs) {
        try {
          const res = await fetch(item.rawUrl);
          if (!res.ok) continue;

          const raw = (await res.json()) as {
            name: string;
            description?: string;
            startup?: string;
            config?: { files?: string; startup?: string; stop?: string; logs?: string };
            scripts?: { installation?: { script?: string; container?: string; entrypoint?: string } };
            variables?: Array<{
              name: string;
              description?: string;
              env_variable: string;
              default_value?: string;
              user_viewable?: boolean;
              user_editable?: boolean;
              rules?: string;
            }>;
            docker_images?: Record<string, string>;
          };

          const nestId = await getOrCreateNest(item.nestName);
          const eggId = randomUUID();

          await db.insert(eggs).values({
            id: eggId,
            uuid: randomUUID(),
            nestId,
            name: raw.name,
            description: raw.description ?? null,
            startup: raw.startup ?? "",
            dockerImages: JSON.stringify(raw.docker_images ?? {}),
            configFiles: raw.config?.files ?? null,
            configStartup: raw.config?.startup ?? null,
            configStop: raw.config?.stop ?? null,
            configLogs: raw.config?.logs ?? null,
            scriptInstall: raw.scripts?.installation?.script ?? null,
            scriptContainer: raw.scripts?.installation?.container ?? null,
            scriptEntry: raw.scripts?.installation?.entrypoint ?? "bash",
          });

          if (raw.variables?.length) {
            await db.insert(eggVariables).values(
              raw.variables.map((v) => ({
                id: randomUUID(),
                eggId,
                name: v.name,
                description: v.description ?? null,
                envVariable: v.env_variable,
                defaultValue: v.default_value ?? null,
                userViewable: v.user_viewable ?? true,
                userEditable: v.user_editable ?? true,
                rules: v.rules ?? null,
              })),
            );
          }

          imported++;
        } catch {
          // skip failed imports silently
        }
      }

      return { imported };
    }),

  completeSetup: adminProcedure.handler(async () => {
    await db
      .insert(settings)
      .values({ key: "setup_complete", value: "true", updatedAt: new Date() })
      .onDuplicateKeyUpdate({ set: { value: "true", updatedAt: new Date() } });
  }),
};
