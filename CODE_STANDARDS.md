# Code Standards — Trendy Interios CRM

Source of truth for code structure, review protocols, and maintenance practices across the monorepo.

---

## 1. Monorepo Structure

```
apps/api      NestJS REST API              port 3001
apps/web      Next.js admin dashboard      port 3000
apps/mobile   Expo React Native staff app
packages/shared  TypeScript types, permission slugs, constants
```

All packages are managed via **pnpm workspaces** and orchestrated with **Turborepo**.

---

## 2. TypeScript

- **Strict mode is mandatory** across all apps. `tsconfig.json` sets `"strict": true`.
- Never use `any`. Use `unknown` + type narrowing, or an explicit interface.
- Shared types live in `packages/shared/src/types/`. If two apps need the same shape, it goes there.
- Run `pnpm type-check` from the repo root before committing. Zero errors required.

---

## 3. API (NestJS)

### Module layout
One module per domain in `apps/api/src/modules/<domain>/`. Each module owns:
```
<domain>.module.ts
<domain>.controller.ts
<domain>.service.ts
schemas/<domain>.schema.ts   (Mongoose schema)
dto/                          (request/response DTOs)
```

### Guard stack
Every route is protected by the following stack in order:
1. `JwtAuthGuard` — verifies JWT and populates `req.user`
2. `PermissionsGuard` + `@RequirePermissions(...)` — checks `rolePermissions`
3. `ProjectScopeGuard` — scopes employee queries to `assignedTeam: { $in: [userId] }`

Never skip a guard to save lines. Add `@Public()` only on auth routes.

### Service rules
- All writes go through the service layer, never directly from a controller.
- Call `ActivityLogService.record(...)` after every create, edit, approval, and status change.
- Inject `DriveService` for file operations; never call Google APIs directly.
- Inject `WhatsAppService` for messaging; never send outside the approval gate.

### DTOs & validation
- Use `class-validator` decorators on all DTOs.
- `ValidationPipe({ whitelist: true, transform: true })` is registered globally — no extra filtering needed in controllers.

### Schemas
- All Mongoose schemas apply `basePlugin` (adds `createdAt`, `updatedAt`, `createdBy`).
- `activityLog` is append-only — no update or delete operations permitted.

---

## 4. Web (Next.js)

### App Router
- All pages live under `apps/web/src/app/(dashboard)/dashboard/<page>/page.tsx`.
- Auth flow lives under `apps/web/src/app/(auth)/`.
- Server components for data fetching; `'use client'` components for interactivity.

### Data fetching
- Use **TanStack Query v5** (`useQuery` / `useMutation`) for all client-side data.
- Always invalidate the relevant query key after a mutation.
- Use `queryKey: ['resource', id?]` naming — be consistent so invalidation works.

### State management
- Auth state lives in `apps/web/src/store/auth.store.ts` (Zustand).
- No global state for server data — let React Query be the cache.

### i18n
- All user-facing strings go through `next-intl` message files: `messages/en.json` and `messages/ta.json`.
- Never hardcode UI strings that should be translatable.

### Null safety
- Always guard optional fields before rendering (e.g., `project.status ?? 'active'`).
- Use `?.` and `?? fallback` instead of assuming populated shape.

---

## 5. Mobile (Expo)

- State: **Redux Toolkit + Redux Persist**.
- Offline: tasks and photos created offline are queued and synced on reconnect.
- Tap targets: minimum **48×48 dp** for all interactive elements (factory/site workers).
- i18n: `i18next` + `react-i18next`.

---

## 6. Shared Package (`packages/shared`)

- Permission slugs: `packages/shared/src/constants/permissions.ts`
- Stage weights: `packages/shared/src/constants/stage-weights.ts`
- Shared TypeScript types: `packages/shared/src/types/`
- Currency helpers: `packages/shared/src/constants/currency.ts` — amounts in INR (2dp float)

Import via `@ti/shared` in all apps.

---

## 7. Environment Variables

Each app has a `.env.example`. Copy to `.env` before running.

**Never commit `.env` files.** Secrets belong in environment variables or a secrets manager, never in client code.

Key variables:

| App | Variable | Purpose |
|-----|----------|---------|
| api | `MONGODB_URI` | MongoDB Atlas connection string |
| api | `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token signing |
| api | `DRIVE_PROVIDER` | `mock` (default) or `google` |
| api | `WHATSAPP_PROVIDER` | `mock` (default) or `meta` |
| web | `NEXT_PUBLIC_API_URL` | API base URL |
| mobile | `EXPO_PUBLIC_API_URL` | API base URL |

---

## 8. Critical Business Rules — Never Bypass

These rules are enforced server-side and tested. Do not circumvent them.

1. **Client isolation** — Employees see only projects where `assignedTeam` contains their user ID. Tested in `test/permission-scoping.spec.ts`.
2. **Approval gate** — Nothing reaches a client without MD/GM approval (or a pre-configured fixed rule). Tested in `test/approval-gate.spec.ts`.
3. **Handover proof** — A handover cannot be raised without at least one proof file. Tested in `test/handover-rules.spec.ts`.
4. **SLA escalation is manual** — Only MD or admin triggers SLA. No automatic escalation.
5. **MFA mandatory** — Any role with `approvals:decide` or `blockers:trigger_sla` requires TOTP MFA.
6. **`whatsapp:send_approved` is system-only** — Never assign it to a user role. It is fired internally by the approval service only.

---

## 9. Git & Branch Protocol

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready. Protected. PRs required. |
| `dev` | Integration branch. All feature branches merge here first. |
| `feat/<name>` | Feature development |
| `fix/<name>` | Bug fix |

### Commit messages
Follow conventional commits:
```
feat(module): short description
fix(module): short description
refactor(module): short description
test(module): short description
docs: short description
```

### Before merging to main
- [ ] `pnpm type-check` — zero errors
- [ ] `pnpm test` (API) — all three critical spec files green
- [ ] `pnpm lint` — zero warnings
- [ ] Playwright e2e — all tests green

---

## 10. Testing

### API unit / integration tests
Located in `apps/api/test/`. Run with `pnpm test` from `apps/api/`.

| File | What it covers |
|------|---------------|
| `permission-scoping.spec.ts` | Employee JWT cannot read unassigned projects |
| `approval-gate.spec.ts` | WhatsApp not called without an approved approval |
| `handover-rules.spec.ts` | Handover POST without proofFiles → 400 |

These three are **gates** — failing any of them blocks the phase from being declared done.

### Playwright E2E tests
Located in `apps/web/e2e/`. Run with `npx playwright test` from `apps/web/`.

Test files follow the `NN-feature.spec.ts` naming convention. Auth setup via `auth.setup.ts` (pre-seeded MD admin credentials). Add new tests to the appropriate numbered file or create a new one.

**Auth credentials for tests** come from the API seed (`SEED_MD_EMAIL` / `SEED_MD_PASSWORD`). Never hardcode production credentials.

### Writing new tests
- Scope locators to `#main-content` or `main` to avoid collisions with the sidebar.
- Use `.filter({ hasText: /pattern/i })` instead of `:has-text()` in pseudo-selectors for complex matches.
- Guard optional UI with `if (await element.isVisible())` rather than asserting things that may not exist in all data states.
- Use `toBeVisible({ timeout: 10000 })` for elements that depend on async data (API calls, React Query fetches).

---

## 11. Dates & Currency

- **Dates**: store UTC (`new Date()`), display IST (`Asia/Kolkata`) using `date-fns-tz`.
- **Currency**: INR, stored as `number` with 2 decimal places. Use helpers in `packages/shared/src/constants/currency.ts`.
- Never store display-formatted strings in the database.

---

## 12. Dependency Additions

Before adding a new package:
1. Check if `packages/shared` already provides it.
2. Prefer workspace-level installs (`pnpm add -w <pkg>`) for shared tooling.
3. App-specific packages: `pnpm add <pkg> --filter apps/<app>`.
4. After any install, run `pnpm type-check` to catch DefinitelyTyped gaps.

---

## 13. Code Review Checklist

- [ ] No `any` types introduced
- [ ] All new routes have the correct guard stack
- [ ] Activity log called after each mutating operation
- [ ] New UI strings have i18n keys
- [ ] Tests cover the happy path and at least one error path
- [ ] No secrets or `.env` content committed
- [ ] `pnpm type-check` passes
