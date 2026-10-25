# Trendy Interios CRM

An end-to-end business management platform for an interior design studio — covering lead capture, project tracking, team coordination, client communication, and automated approvals from first enquiry to final handover.

---

## Quick start

```bash
# Install all workspaces
pnpm install

# Copy and fill in environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start API (port 3001) + web dashboard (port 3000) together
pnpm dev
```

See **[docs/SETUP.md](docs/SETUP.md)** for the full setup guide.

---

## What's inside

```
apps/api        NestJS REST API + Socket.IO   (port 3001)
apps/web        Next.js 14 admin dashboard    (port 3000)
apps/mobile     Expo React Native staff app
packages/shared TypeScript types + permission slugs
docs/           Architecture, setup, integrations, roadmap
```

---

## Documentation

| File | Contents |
|---|---|
| [docs/README.md](docs/README.md) | Feature overview and key business rules |
| [docs/SETUP.md](docs/SETUP.md) | Local development setup, env vars, seeding |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | Every dependency and why it was chosen |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | MongoDB, Google Drive, WhatsApp, FCM, AI, MFA |
| [docs/FUTURE_IMPROVEMENTS.md](docs/FUTURE_IMPROVEMENTS.md) | Roadmap, known limitations, completed work |
| [docs/GIT_RULES.md](docs/GIT_RULES.md) | Branch strategy and commit conventions |
| [docs/SOW.md](docs/SOW.md) | Statement of work — source of truth |

---

## Commands

| From | Command | What it does |
|---|---|---|
| root | `pnpm dev` | Start API + web in parallel |
| root | `pnpm build` | Build all apps |
| root | `pnpm test` | Run all tests |
| root | `pnpm lint` | Lint all packages |
| root | `pnpm type-check` | TypeScript check across all packages |
| `apps/api` | `pnpm test:e2e` | API end-to-end tests |
| `apps/mobile` | `pnpm start` | Start Expo dev server |

---

## Key business rules

1. Employees see only projects they are assigned to — enforced server-side on every query.
2. Nothing reaches a client without MD/GM approval passing through the approval gate.
3. A handover cannot be raised without at least one uploaded proof file.
4. SLA escalation is manual — the MD triggers it; no automatic timer.
5. MFA is mandatory for any role with `approvals:decide` or `blockers:trigger_sla`.
