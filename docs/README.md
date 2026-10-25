# Trendy Interios CRM

An end-to-end business management platform for an interior design studio — covering lead capture, project tracking, team coordination, client communication, and automated approvals from enquiry to final handover.

---

## What it does

| Capability | Description |
|---|---|
| **Client management** | Track leads, onboard clients, record WhatsApp opt-in |
| **Project pipeline** | 8 configurable production stages with SLA timers |
| **Task tracking** | Per-department task boards with photo proof |
| **Handover flow** | Raise → Confirm → Accept/Reject with mandatory proof upload |
| **Approval gate** | All client-facing messages require MD/GM approval before sending |
| **AI message drafting** | LLM drafts WhatsApp updates in English or Tamil |
| **Blockers & SLA** | Manual SLA escalation by MD; open blocker dashboard |
| **Real-time chat** | Socket.IO chat — department channels, project groups, direct messages |
| **Document drive** | File upload via Google Drive (or Cloudinary); downloadable links |
| **Role-based access** | 4 default roles (MD, GM, Dept Head, Employee) with 30+ permission slugs |
| **Admin dashboard** | Charts: project status, SLA performance, team workload, completion trend |

---

## Repository layout

```
apps/
  api/        NestJS REST API + Socket.IO gateway  (port 3001)
  web/        Next.js 14 admin dashboard            (port 3000)
  mobile/     Expo React Native staff app

packages/
  shared/     TypeScript types, permission slugs, constants

docs/
  README.md             ← this file
  TECH_STACK.md         Technology choices and rationale
  SETUP.md              Local development setup guide
  INTEGRATIONS.md       Third-party service configuration
  FUTURE_IMPROVEMENTS.md Planned enhancements and roadmap
  GIT_RULES.md          Branch strategy and commit conventions
  SOW.md                Statement of work (source of truth)
  PLAN.md               Implementation plan
```

---

## Quick start

```bash
# 1. Install all workspaces
pnpm install

# 2. Copy env files and fill in values
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Start API + web together
pnpm dev

# 4. Open the dashboard
open http://localhost:3000
```

See **[SETUP.md](./SETUP.md)** for the full guide including MongoDB, Google Drive, and WhatsApp configuration.

---

## Key business rules

1. **Client isolation** — Employees see only projects they are assigned to. Enforced server-side in every query.
2. **Approval gate** — Nothing reaches a client without MD/GM approval. No direct employee-to-client messaging.
3. **Handover proof** — A handover cannot be raised without at least one uploaded proof file.
4. **SLA escalation is manual** — MD or admin triggers SLA; no automatic escalation timer.
5. **MFA mandatory** — Required for any role with `approvals:decide` or `blockers:trigger_sla`.
6. **`whatsapp:send_approved`** — System-only internal permission; never assignable to a user role.

---

## Contributing

See [GIT_RULES.md](./GIT_RULES.md) for branch strategy, commit conventions, and PR rules.

All features are developed against the `dev` branch. PRs targeting `main` require at least one approval and passing CI.
