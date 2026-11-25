# CLAUDE.md — Trendy Interios CRM

Source of truth: `docs/SOW.md`. If this file and the SOW disagree, the SOW wins.

---

## Monorepo Layout

```
apps/api      NestJS REST API (port 3001)
apps/web      Next.js admin dashboard (port 3000)
apps/mobile   Expo React Native staff app
packages/shared  TypeScript types, permission slugs, constants
```

Package manager: **pnpm**. Task runner: **Turborepo**.

---

## Commands

### Root (run from repo root)
```bash
pnpm install          # install all workspaces
pnpm dev              # start api + web in parallel (turbo)
pnpm build            # build all apps
pnpm test             # run all tests
pnpm lint             # lint all packages
pnpm type-check       # tsc --noEmit across all packages
```

### API only (`apps/api`)
```bash
pnpm dev              # nest start --watch
pnpm build            # nest build
pnpm test             # jest
pnpm test:e2e         # jest --config jest-e2e.json
```

### Web only (`apps/web`)
```bash
pnpm dev              # next dev
pnpm build            # next build
pnpm type-check       # tsc --noEmit
```

### Mobile only (`apps/mobile`)
```bash
pnpm start            # expo start
pnpm android          # expo run:android
pnpm ios              # expo run:ios
pnpm type-check       # tsc --noEmit
```

---

## Environment Variables

Each app has a `.env.example`. Copy to `.env` and fill in values. **Never commit `.env` files.**

### `apps/api/.env.example`
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
DRIVE_PROVIDER=mock              # mock | google
GOOGLE_DRIVE_SERVICE_ACCOUNT=    # JSON string (google only)
WHATSAPP_PROVIDER=mock           # mock | meta
WHATSAPP_API_TOKEN=              # meta only
WHATSAPP_PHONE_NUMBER_ID=        # meta only
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=
PORT=3001
```

### `apps/web/.env.example`
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### `apps/mobile/.env.example`
```
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1
EXPO_PUBLIC_WS_URL=http://localhost:3001
```

---

## Conventions

### General
- TypeScript strict mode everywhere.
- No `any` — use `unknown` or explicit types.
- English code identifiers; UI strings go through i18n keys (`en` + `ta`).
- Dates: store UTC, display IST (`Asia/Kolkata`). Use `date-fns-tz`.
- Currency: INR, stored as `number` (2dp). Helpers in `packages/shared/src/constants/currency.ts`.

### API (NestJS)
- One module per domain in `apps/api/src/modules/`.
- Guards: `JwtAuthGuard` (all routes) → `RolesGuard` (permission slug) → `ProjectScopeGuard` (employee isolation).
- Every query for an Employee is scoped to `assignedTeam: { $in: [userId] }` — enforced in the service layer via `ProjectScopeGuard`.
- No client messages without passing through the approval gate service.
- Activity log: call `ActivityLogService.record(...)` after every create, edit, approval, and status change.
- Drive: inject `DriveService`; never call Google APIs directly from controllers.
- WhatsApp: inject `WhatsAppService`; never send messages outside the approval service.

### Schemas
- All Mongoose schemas use the `basePlugin` (adds `createdAt`, `updatedAt`, `createdBy`).
- `activityLog` is append-only — no update or delete allowed.

### Web (Next.js)
- App Router (`app/` directory).
- Auth via JWT stored in httpOnly cookies (set by API).
- Server components for data fetching; client components for interactivity.
- i18n: `next-intl` with `en` and `ta` message files.

### Mobile (Expo)
- State: Redux Toolkit + Redux Persist.
- Offline queue: `redux-offline` or custom middleware — tasks and photos created offline are queued and synced on reconnect.
- Large tap targets (min 48×48 dp) for factory/site workers.
- i18n: `i18next` + `react-i18next`.

---

## Critical Business Rules (never bypass)

1. **Client isolation:** Employees see only their `assignedProjects`. Enforced server-side. Tested in `test/permission-scoping.spec.ts`.
2. **Approval gate:** Nothing reaches a client without MD/GM approval (or a pre-configured fixed rule). Tested in `test/approval-gate.spec.ts`.
3. **Handover proof:** A handover cannot be raised without at least one photo uploaded. Tested in `test/handover-rules.spec.ts`.
4. **SLA escalation is manual:** The MD or admin triggers SLA — no automatic escalation.
5. **MFA mandatory** for any role with `approvals:decide` or `blockers:trigger_sla`.
6. **`whatsapp:send_approved`** is a system-only internal permission — never assign it to a user role.

---

## Seeded Data (runs on first start)

- 8 default departments in order: Enquiry, Measurement, Design, Purchase, Manufacturing, Assembly, Delivery, Final Clean & Handover
- 4 default roles: MD, GM, Department Head, Employee (with permission sets per PLAN.md)
- SLA defaults: 48h per stage (editable in dashboard)
- One MD super-admin user created from `SEED_MD_EMAIL` / `SEED_MD_PASSWORD` env vars

---

## Test Files (must be green before each phase is declared done)

| File | What it tests |
|------|---------------|
| `apps/api/test/permission-scoping.spec.ts` | Employee JWT cannot fetch un-assigned projects |
| `apps/api/test/approval-gate.spec.ts` | WhatsApp service not called without approved approval |
| `apps/api/test/handover-rules.spec.ts` | Handover POST without proofFiles → 400 |

---

## Git Rules

- **Never add `Co-Authored-By: Claude` (or any Claude authorship line) to commit messages.** Commits are authored by the developer only.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `security:`, `docs:`, `refactor:`, `chore:`).
- Never commit `.env` files or secrets.
- **Never open (or retarget) a pull request against `dev` or `main`.** Claude does not have the rights to, and must not try. Open pull requests into `dev-env` only (`gh pr create --base dev-env`); a developer promotes `dev-env` to `dev` and `main`. Pushing feature branches is fine.
- `dev-env` is not covered by CI (`ci.yml` runs only for `dev` and `main`), so run type-check and tests locally before opening a PR into it and say so in the PR description.
