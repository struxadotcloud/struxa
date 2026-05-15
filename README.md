# struxa

> An open-source game server management panel. Built to replace Pterodactyl.

---

> [!CAUTION]
> **This project is in active, bare development.** There is no alpha, no stable release, and no deployment guide. The API surface changes without notice. Do not use Struxa for anything beyond local development and experimentation. It is not functional as a product yet.

---

## What is Struxa?

Struxa is a self-hosted server management panel designed to be a modern, open-source replacement for [Pterodactyl](https://pterodactyl.io). It is built with a fully typed TypeScript stack, a monorepo architecture, and a dark, operator-focused UI aesthetic.

The immediate focus is game server management — create, configure, and control game servers from a single panel. The longer-term roadmap expands into VPS management, node orchestration, and infrastructure tooling.

Struxa is **not** a fork of Pterodactyl. It is a clean-room implementation with a different architecture, a different design language, and a different set of priorities.

---

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

---

## Tech Stack

| Layer         | Technology                                                          |
| ------------- | ------------------------------------------------------------------- |
| Framework     | [Next.js 16](https://nextjs.org) + [React 19](https://react.dev)    |
| Language      | TypeScript (strict)                                                 |
| API           | [oRPC](https://orpc.unnoq.com) — end-to-end type-safe procedures    |
| Database      | MySQL + [Drizzle ORM](https://orm.drizzle.team)                     |
| Auth          | [Better-Auth](https://better-auth.com)                              |
| Data Fetching | [TanStack Query](https://tanstack.com/query)                        |
| UI Primitives | [shadcn/ui](https://ui.shadcn.com) via shared `packages/ui`         |
| Styling       | [Tailwind CSS 4](https://tailwindcss.com)                           |
| Monorepo      | [Turborepo](https://turbo.build) + [Bun workspaces](https://bun.sh) |
| Runtime       | [Bun](https://bun.sh)                                               |
| Linting       | Oxlint + Oxfmt                                                      |

---

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

---

## Getting Started

> These steps are for local development only. There is no production deployment guide yet.

### Prerequisites

- [Bun](https://bun.sh) `>= 1.3.5`
- MySQL database (Docker recommended)

### Setup

```bash
# Clone the repo
git clone https://github.com/stripsior/struxa.git
cd struxa

# Install dependencies
bun install

# Set up environment variables
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env with your database credentials and auth secrets

# Start the database (if using Docker)
bun run db:start

# Push the schema
bun run db:push

# Start the dev server
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Useful Scripts

| Command               | Description                               |
| --------------------- | ----------------------------------------- |
| `bun run dev`         | Start all apps in development mode        |
| `bun run build`       | Build all apps                            |
| `bun run check-types` | TypeScript type check across all packages |
| `bun run check`       | Lint and format with Oxlint/Oxfmt         |
| `bun run db:push`     | Push schema changes to database           |
| `bun run db:generate` | Generate migration files                  |
| `bun run db:migrate`  | Run pending migrations                    |
| `bun run db:studio`   | Open Drizzle Studio                       |
| `bun run db:start`    | Start MySQL via Docker Compose            |
| `bun run db:stop`     | Stop MySQL container                      |

---

## Roadmap

The roadmap is tracked via GitHub Issues and GitHub Projects. If you want to follow progress, watch the repository or check the Issues tab. There is no public timeline.

---

## Contributing

Contributions are welcome — code, bug reports, design feedback, and documentation all count. See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to get started.

Note that because the project is in early development, large features may be deferred or redirected if they conflict with the current architecture direction.

---

## Design

Struxa uses a strict dark ops panel design language documented in [DESIGN.md](./DESIGN.md). All UI contributions must follow it. The short version: dark, dense, operator-focused — no decorative elements, color used only for status signals.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <sub>Struxa is not affiliated with Pterodactyl or any game server hosting provider.</sub>
</p>
