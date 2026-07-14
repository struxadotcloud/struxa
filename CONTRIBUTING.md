# Contributing to Struxa

Thank you for your interest in contributing. Struxa is an open-source project and every bit of help — code, bug reports, design critique, or documentation — moves it forward.

---

## Ways to Contribute

- **Bug reports** — open an Issue describing what happened, what you expected, and your environment
- **Feature requests** — open an Issue with a clear description of the problem you are solving, not just the solution
- **Code** — pick up an open Issue, discuss your approach in the Issue thread, then open a PR
- **Design feedback** — UI/UX critique on open Issues or PRs is welcome; refer to [DESIGN.md](./DESIGN.md)
- **Documentation** — improve README, CONTRIBUTING, or inline code comments

If you are unsure where to start, look for Issues labeled `good first issue`.

---

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) `>= 1.3.5`
- MySQL (local install or Docker)
- Node.js is not required — Bun handles everything

### Steps

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/struxa.git
cd struxa

# 2. Install dependencies (Bun workspaces installs all packages)
bun install

# 3. Set up environment variables
cp apps/web/.env.example apps/web/.env
# Fill in your DATABASE_URL, BETTER_AUTH_SECRET, and any other required vars

# 4. Start the database
bun run db:start          # spins up MySQL via Docker Compose

# 5. Push the schema to your database
bun run db:push

# 6. Set up git hooks
bun run prepare

# 7. Start the dev server
bun run dev               # panel runs at http://localhost:3001
```

---

## Monorepo Structure

| Path               | Package          | What goes here                                            |
| ------------------ | ---------------- | --------------------------------------------------------- |
| `apps/web/`        | —                | Next.js panel app. Pages, routes, app-specific components |
| `apps/fumadocs/`   | —                | Documentation site                                        |
| `packages/ui/`     | `@struxa/ui`     | Shared shadcn/ui primitives and global styles             |
| `packages/api/`    | `@struxa/api`    | oRPC router definitions and procedures                    |
| `packages/auth/`   | `@struxa/auth`   | Better-Auth server and client configuration               |
| `packages/db/`     | `@struxa/db`     | Drizzle ORM schema, migrations, and DB client             |
| `packages/env/`    | `@struxa/env`    | Environment variable parsing and validation               |
| `packages/config/` | `@struxa/config` | Shared TypeScript compiler config                         |

**Rule of thumb**: if logic is used in more than one app, it belongs in a package. If a UI component is used across multiple pages, it belongs in `packages/ui`. Keep `apps/web` lean.

---

## Code Style

- **TypeScript strict** — no `any`, no skipped type errors
- **Formatting** — Oxfmt handles it; run `bun run check` before committing
- **Linting** — Oxlint; run `bun run check` before committing
- **Environment variables** — all env vars must go through `packages/env`; do not read `process.env` directly in app code
- **Authentication** — use Better-Auth via `packages/auth`; do not implement manual token management
- **UI** — compose from `@struxa/ui` before creating app-local primitives; follow [DESIGN.md](./DESIGN.md) for all visual decisions
- **API** — define procedures in `packages/api`; do not write raw fetch calls to your own backend

---

## Commit Convention

Struxa uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

| Type       | When to use                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | New feature or capability                       |
| `fix`      | Bug fix                                         |
| `refactor` | Code change that is neither a fix nor a feature |
| `chore`    | Build, tooling, or dependency changes           |
| `docs`     | Documentation only                              |
| `style`    | Formatting, no logic change                     |
| `test`     | Adding or updating tests                        |

Examples:

```
feat(api): add server start/stop procedures
fix(auth): handle expired session redirect
docs: update getting started steps in README
chore(db): upgrade drizzle-orm to 0.43.0
```

---

## Pull Request Process

1. **Branch** off `main`. Use `feat/<short-name>`, `fix/<short-name>`, or `chore/<short-name>`.
2. **Keep PRs small and focused.** One concern per PR. Split large changes into a sequence.
3. **Link the Issue** your PR addresses in the PR description.
4. **Run checks locally** before opening:
   ```bash
   bun run check-types
   bun run check
   ```
5. **Fill in the PR template** — describe what changed, why, and how to verify it manually.
6. **UI changes** — include a screenshot or screen recording. State which parts of [DESIGN.md](./DESIGN.md) apply and how you followed them.
7. A maintainer will review. Expect feedback. Do not merge your own PRs.

---

## Design Guidelines

All UI work must follow the design language documented in [DESIGN.md](./DESIGN.md). The core rules:

- Dark background (`#0a0a0a` / `#141414` surfaces)
- Text hierarchy: white primary, `#888888` labels, `#555555` muted
- Green (`#22c55e`) for status indicators and charts only
- Amber (`#f59e0b`) for primary CTAs only
- Rose (`#f43f5e`) for destructive actions only
- No border radius (or minimal — `rounded-sm` maximum for inputs)
- ALL CAPS labels with wide letter-spacing
- Monospace font for any terminal, log, or code surface

If a design decision is not covered by DESIGN.md, open a discussion before implementing.

---

## Code of Conduct

- Be direct and constructive. Critique the code, not the person.
- Assume good intent until proven otherwise.
- Maintainers may close Issues or PRs without explanation if they are out of scope.
- No harassment, discrimination, or bad-faith behavior. Violations result in a ban.

This project follows the spirit of the [Contributor Covenant](https://www.contributor-covenant.org/).

---

## Questions?

Open an Issue with the `question` label. Do not DM maintainers directly.
