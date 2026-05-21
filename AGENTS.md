# AGENTS.md

This document defines how AI coding agents should operate in this repository.

## Scope

- Applies to the entire monorepo rooted at `struxav2/`.
- If a nested directory later adds its own `AGENTS.md`, the nested one overrides this file for that subtree.

## Critical Rule

- Do not run the project locally.
- Do not start dev servers (`bun run dev`, `next dev`, `docker compose up`, etc.).
- Do not run long-lived/watch processes.

## Project Overview

- Monorepo managed with Bun workspaces and Turborepo.
- Apps:
  - `apps/web`: Next.js fullstack app (port 3001 in local scripts).
  - `apps/fumadocs`: Documentation site.
- Shared packages:
  - `packages/ui`: shared UI primitives/styles (`@struxa/ui`).
  - `packages/api`: oRPC router and procedures (`@struxa/api`).
  - `packages/auth`: better-auth configuration (`@struxa/auth`).
  - `packages/db`: Drizzle ORM schema and database client (`@struxa/db`).
  - `packages/env`: environment schemas/helpers (`@struxa/env`).
  - `packages/config`: shared TypeScript config (`@struxa/config`).

## Tech Stack

- Bun (`packageManager: bun@1.3.5`)
- Turborepo
- Next.js 16 + React 19
- Tailwind CSS 4
- better-auth (authentication)
- Drizzle ORM + MySQL
- oRPC (type-safe API layer)
- TanStack Query (data fetching)
- shadcn/ui style component setup in shared UI package

## Workspace Commands (Reference Only)

Use these as documentation for intent; avoid executing runtime/dev commands unless the user explicitly asks and confirms.

- Root:
  - `bun run dev`
  - `bun run build`
  - `bun run check-types`
- App scripts:
  - `apps/web`: `dev`, `build`, `start`
- DB scripts (run from root or `packages/db`):
  - `db:push`, `db:generate`, `db:migrate`, `db:studio`
  - `db:start`, `db:stop`, `db:down` (Docker compose)

## Agent Working Agreement

- Make minimal, targeted changes that satisfy the user request.
- Preserve existing architecture and naming conventions.
- Avoid broad refactors unless requested.
- Do not edit generated/lock files unless required by the task.
- Do not add new dependencies unless necessary and justified.
- Prefer shared package reuse over duplication in apps.

## Editing Guidelines

- Keep changes consistent with existing TypeScript/React style.
- For UI work, prefer composing from `@struxa/ui` components before adding app-local primitives.
- Put shared logic in `packages/*` when used by multiple apps.
- Keep environment parsing centralized in `packages/env`.
- Keep API contract/type updates synchronized across `packages/api`, `packages/auth`, and `packages/db` where relevant.
- Auth is handled by better-auth via `packages/auth` — do not implement manual token management.

## Validation Strategy (No App Runtime)

Because running the project is disallowed by default:

- Prefer static checks only when needed and safe (lint/type/build commands are allowed only if user asks or task requires verification).
- If validation is skipped, clearly state what was not run and why.
- Provide a concise manual verification checklist for the user when useful.

## Data, Secrets, and Safety

- Never commit secrets or real credentials.
- Treat `.env` files as sensitive; use `.env.example` patterns.
- Avoid destructive commands (`rm -rf`, hard resets, force pushes) unless explicitly requested.

## Paths and Conventions

- Root task orchestration: `turbo.json`, `package.json`.
- Main docs: `README.md`.
- MCP settings: `.mcp.json`.

## Preferred Agent Response Shape

- Start with what changed.
- List exact files touched.
- Note any commands run.
- Note what was not run (especially app runtime) and why.
- End with optional next steps.
