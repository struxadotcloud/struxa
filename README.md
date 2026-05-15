<div align="center">

# struxa

**An open-source game server management panel.**
Built to replace Pterodactyl — modern stack, dark UI, fully self-hosted.

<br />

![GitHub Stars](https://www.shieldcn.dev/github/stars/struxadotcloud/struxa.svg?variant=secondary&size=sm)
![GitHub Forks](https://www.shieldcn.dev/github/forks/struxadotcloud/struxa.svg?variant=secondary&size=sm)
![Last commit](https://www.shieldcn.dev/github/last-commit/struxadotcloud/struxa.svg?variant=secondary&size=sm)
![Open issues](https://www.shieldcn.dev/github/open-issues/struxadotcloud/struxa.svg?variant=secondary&size=sm)
![Release](https://www.shieldcn.dev/github/release/struxadotcloud/struxa.svg?size=sm)
![License](https://www.shieldcn.dev/github/license/struxadotcloud/struxa.svg?variant=ghost&size=sm)

![Package mgr · Bun](https://www.shieldcn.dev/badge/Package_mgr-Bun-000000.svg?logo=bun&variant=branded&size=sm)
![Language · TypeScript](https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&variant=branded&size=sm)
![Monorepo · Turborepo](https://www.shieldcn.dev/badge/Monorepo-Turborepo-EF4444.svg?logo=turborepo&variant=branded&size=sm)
![Agent-friendly AGENTS.md](https://www.shieldcn.dev/badge/Agent--friendly-AGENTS.md-D97757.svg?variant=secondary&size=sm)

<img src=".github/uploads/preview-small.jpeg" alt="Struxa panel preview" width="860" />

</div>

> [!CAUTION]
> **This project is in active, bare development.** There is no alpha, no stable release, and no deployment guide. The API surface changes without notice. Do not use Struxa for anything beyond local development and experimentation. It is not functional as a product yet.

<br />

## What is Struxa?

Struxa is a self-hosted server management panel designed to be a modern, open-source replacement for [Pterodactyl](https://pterodactyl.io). It is built with a fully typed TypeScript stack, a monorepo architecture, and a dark, operator-focused UI aesthetic.

The immediate focus is game server management — create, configure, and control game servers from a single panel. The longer-term roadmap expands into VPS management, node orchestration, and infrastructure tooling.

Struxa is **not** a fork of Pterodactyl. It is a clean-room implementation with a different architecture, a different design language, and a different set of priorities.

## Planned Features

These are goals, not guarantees. Nothing below is shipped.

- [ ] Game server lifecycle management (create, start, stop, restart, delete)
- [ ] Real-time console streaming
- [ ] Resource monitoring (CPU, RAM, disk, network)
- [ ] File manager with editor
- [ ] Multi-user support with role-based access control
- [ ] Node management and agent communication
- [ ] VPS provisioning and management
- [ ] API key management
- [ ] Activity and audit logs
- [ ] Billing and resource quotas (future)
- [ ] Egg/image marketplace (future)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) + [React 19](https://react.dev) |
| Language | TypeScript (strict) |
| API | [oRPC](https://orpc.unnoq.com) — end-to-end type-safe procedures |
| Database | MySQL + [Drizzle ORM](https://orm.drizzle.team) |
| Auth | [Better-Auth](https://better-auth.com) |
| Data Fetching | [TanStack Query](https://tanstack.com/query) |
| UI Primitives | [shadcn/ui](https://ui.shadcn.com) via shared `packages/ui` |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Monorepo | [Turborepo](https://turbo.build) + [Bun workspaces](https://bun.sh) |
| Runtime | [Bun](https://bun.sh) |
| Linting | Oxlint + Oxfmt |

## Project Structure

```
struxa/
├── apps/
│   ├── web/              # Main Next.js panel application (port 3001)
│   └── fumadocs/         # Documentation site
├── packages/
│   ├── ui/               # Shared UI primitives (@struxa/ui)
│   ├── api/              # oRPC router and procedures (@struxa/api)
│   ├── auth/             # Better-Auth config (@struxa/auth)
│   ├── db/               # Drizzle ORM schema and client (@struxa/db)
│   ├── env/              # Environment variable schemas (@struxa/env)
│   └── config/           # Shared TypeScript config (@struxa/config)
├── DESIGN.md             # UI/UX design reference
├── CONTRIBUTING.md       # Contributor guide
└── turbo.json            # Turborepo pipeline
```

## Getting Started

> These steps are for local development only. There is no production deployment guide yet.

**Prerequisites:** [Bun](https://bun.sh) `>= 1.3.5` · MySQL (Docker recommended)

```bash
# Clone the repo
git clone https://github.com/struxadotcloud/struxa.git
cd struxa

# Install dependencies
bun install

# Set up environment variables
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env with your database credentials and auth secrets

# Start the database (Docker)
bun run db:start

# Push the schema
bun run db:push

# Start the dev server
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

<details>
<summary>All available scripts</summary>

| Command | Description |
|---|---|
| `bun run dev` | Start all apps in development mode |
| `bun run build` | Build all apps |
| `bun run check-types` | TypeScript type check across all packages |
| `bun run check` | Lint and format with Oxlint/Oxfmt |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Generate migration files |
| `bun run db:migrate` | Run pending migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:start` | Start MySQL via Docker Compose |
| `bun run db:stop` | Stop MySQL container |

</details>

## Roadmap

The roadmap is tracked via GitHub Issues and GitHub Projects. If you want to follow progress, watch the repository or check the Issues tab. There is no public timeline.

## Contributing

Contributions are welcome — code, bug reports, design feedback, and documentation all count. See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to get started.

Note that because the project is in early development, large features may be deferred or redirected if they conflict with the current architecture direction.

## License

MIT — see [LICENSE](./LICENSE) for details.

<br />

<div align="center">
  <sub>Struxa is not affiliated with Pterodactyl or any game server hosting provider.</sub>
</div>
