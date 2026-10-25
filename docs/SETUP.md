# Local Development Setup

Follow these steps to run the full Trendy Interios CRM stack on your machine.

---

## Prerequisites

| Requirement | Minimum version | Check |
|---|---|---|
| Node.js | 20 LTS | `node -v` |
| pnpm | 9+ | `pnpm -v` |
| MongoDB | Atlas cluster or local 7+ | — |
| Git | Any recent | `git -v` |

Install pnpm if you don't have it:

```bash
npm install -g pnpm
```

---

## 1. Clone and install

```bash
git clone <repo-url> trendy-interios
cd trendy-interiors
pnpm install          # installs all workspaces
```

---

## 2. Configure environment variables

### API (`apps/api/.env`)

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fill in:

```env
# ── Database ────────────────────────────────────────────────────────────────
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>?retryWrites=true

# ── Auth ────────────────────────────────────────────────────────────────────
JWT_SECRET=<at-least-32-random-chars>
JWT_REFRESH_SECRET=<different-32-random-chars>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# ── Seed admin account (runs once on first start) ───────────────────────────
SEED_MD_EMAIL=md@trendyinteriors.in
SEED_MD_PASSWORD=SecurePassword123!

# ── File storage ────────────────────────────────────────────────────────────
DRIVE_PROVIDER=mock                         # mock | google | cloudinary
# Google Drive (set DRIVE_PROVIDER=google):
GOOGLE_DRIVE_SERVICE_ACCOUNT=              # JSON string of service account key

# ── WhatsApp ────────────────────────────────────────────────────────────────
WHATSAPP_PROVIDER=mock                     # mock | meta
WHATSAPP_API_TOKEN=                        # Meta Business API token (meta only)
WHATSAPP_PHONE_NUMBER_ID=                  # Meta phone number ID (meta only)

# ── Push notifications ───────────────────────────────────────────────────────
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=

# ── Server ───────────────────────────────────────────────────────────────────
PORT=3001
```

> **Never commit `.env` files.** They are in `.gitignore`.

### Web (`apps/web/.env`)

```bash
cp apps/web/.env.example apps/web/.env
```

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### Mobile (`apps/mobile/.env`)

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api/v1
EXPO_PUBLIC_WS_URL=http://localhost:3001
```

---

## 3. Start the development servers

### Run API + web together (recommended)

```bash
pnpm dev          # from repo root — Turborepo starts both in parallel
```

| App | URL |
|---|---|
| API | http://localhost:3001 |
| Web dashboard | http://localhost:3000 |

### Run individually

```bash
# API only
cd apps/api && pnpm dev

# Web only
cd apps/web && pnpm dev

# Mobile (requires Expo CLI and a device/emulator)
cd apps/mobile && pnpm start
```

---

## 4. Seed data

The API seeds default data automatically on first start when `SEED_MD_EMAIL` and `SEED_MD_PASSWORD` are set:

| Seeded | Detail |
|---|---|
| 8 departments | Enquiry → Measurement → Design → Purchase → Manufacturing → Assembly → Delivery → Final Clean & Handover |
| 4 roles | MD, GM, Department Head, Employee (with permission sets per PLAN.md) |
| SLA defaults | 48 hours per stage (editable in dashboard) |
| 1 MD super-admin | Created from `SEED_MD_EMAIL` / `SEED_MD_PASSWORD` |

Log in with the MD credentials to access the full dashboard.

---

## 5. Run tests

```bash
# All tests (from repo root)
pnpm test

# API unit + E2E tests only
cd apps/api && pnpm test && pnpm test:e2e

# Web type check
cd apps/web && pnpm type-check

# Mobile type check
cd apps/mobile && pnpm type-check
```

The three critical spec files that must be green before any phase is declared done:

| File | What it tests |
|---|---|
| `apps/api/test/permission-scoping.spec.ts` | Employee JWT cannot fetch un-assigned projects |
| `apps/api/test/approval-gate.spec.ts` | WhatsApp service not called without an approved approval |
| `apps/api/test/handover-rules.spec.ts` | Handover POST without `proofFiles` → 400 |

---

## 6. Build for production

```bash
# Build all apps
pnpm build

# Build individually
cd apps/api && pnpm build        # outputs to dist/
cd apps/web && pnpm build        # outputs to .next/
```

---

## Common issues

| Problem | Fix |
|---|---|
| `MongoServerError: bad auth` | Check `MONGODB_URI` — password may contain special characters that need URL-encoding |
| `JWT_SECRET must be set` | Ensure `apps/api/.env` exists and has `JWT_SECRET` |
| Port 3001 in use | Kill the process on 3001 or change `PORT=` in `.env` |
| pnpm workspace not found | Run `pnpm install` from the repo root, not inside a single app |
| Mobile: API unreachable | Use your machine's local IP (`192.168.x.x`) instead of `localhost` in `EXPO_PUBLIC_API_URL` on physical devices |
| `tsc` errors after pulling | Run `pnpm install` — a new package may have been added |

---

## Environment variable reference

Full list of all variables across all apps: see `.env.example` files in each app directory.
