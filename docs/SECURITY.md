# Security Guide

Source of truth for security decisions in the Trendy Interiors CRM. Keep this up to date when controls are added or changed.

---

## Authentication & Tokens

### JWT Strategy
- Access tokens expire in **15 minutes** (`JWT_ACCESS_EXPIRES`).
- Refresh tokens expire in **7 days** (`JWT_REFRESH_EXPIRES`).
- Refresh tokens are stored **hashed** in MongoDB (`refreshTokens[]` on the User document).
- At most **10 refresh tokens** are kept per user (`$push.$slice: -10`) — oldest are evicted automatically.
- On logout the token is removed from the array; on password change all tokens are wiped.

### Token Storage (Web)
- Access and refresh tokens are **memory-only** in the Zustand store — they are **not** persisted to `localStorage` or any browser storage.
- The `persist` middleware stores only the non-sensitive `user` profile object (`partialize`).
- Consequence: tokens are lost on page reload. The app re-authenticates via the refresh-token cookie flow or prompts re-login.

### MFA
- TOTP (RFC 6238) via `otplib`. QR code generated server-side; the raw `base32` secret is **never** returned to the client after setup.
- MFA is **mandatory** for any role that has `approvals:decide` or `blockers:trigger_sla` permissions.
- Enforced in `JwtAuthGuard` — requests without a valid TOTP challenge are rejected 401.

---

## Authorization

### Guard Stack
Every authenticated route passes through this chain in order:

```
JwtAuthGuard → RolesGuard → PermissionsGuard → ProjectScopeGuard
```

- **JwtAuthGuard** — verifies the JWT, attaches `req.user`.
- **RolesGuard** — checks role-level allow list when `@RequireRoles()` is present.
- **PermissionsGuard** — checks individual permission slugs when `@RequirePermissions()` is present.
- **ProjectScopeGuard** — scopes any Employee query to `{ assignedTeam: { $in: [userId] } }`. Applied automatically for all project/task/handover/blocker reads.

### Permission Slugs
Full list is in `packages/shared/src/constants/permissions.ts`. Critical system-only slugs:

| Slug | Notes |
|------|-------|
| `whatsapp:send_approved` | **System-only** — never assign to a user role. Fired internally after the approval gate. |
| `approvals:decide` | Triggers MFA enforcement. MD and GM only. |
| `blockers:trigger_sla` | Triggers MFA enforcement. MD only. |

---

## Input Validation

### ReDoS Prevention
All user-supplied strings used in MongoDB `$regex` queries are escaped before use:

```typescript
const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

Currently applied in: `clients.service.ts` (`findAll` search), `projects.service.ts` search.

### File Uploads
Enforced in `documents.controller.ts`:
- Maximum file size: **25 MB**.
- Allowed MIME types: `image/*`, `application/pdf`, `application/vnd.*`, `application/msword`.
- Validation runs in the Multer `fileFilter` before the buffer is read.

---

## WhatsApp & Webhooks

### Inbound Webhook Verification (`POST /api/v1/webhooks/whatsapp`)
1. NestJS is started with `rawBody: true` so the raw request body is available as `Buffer`.
2. The `X-Hub-Signature-256` header from Meta is compared against `HMAC-SHA256(META_APP_SECRET, rawBody)` using **constant-time comparison** (`timingSafeEqual`) to prevent timing attacks.
3. If `META_APP_SECRET` is not set (e.g., local dev with mock provider), the signature check is skipped.

### Outbound Flow
No staff member or API route can directly send a WhatsApp message. The only path is:

```
Staff requests approval → MD/GM approves → ApprovalsService.approve()
  → WhatsAppService.sendTemplate() → Meta Business API
```

Enforced by: no public endpoint for WhatsApp sends, `whatsapp:send_approved` permission not assignable to users.

### Opt-Out
When a client replies **STOP**, `WebhooksService.processMessage()` sets `client.whatsappOptIn = false`. All future sends in `ApprovalsService` check `client.whatsappOptIn !== false` before calling the WhatsApp service.

---

## Seed & Demo Data

The `SeedService` creates demo users (GM, Dept Head, Employee with known passwords) **only** when:
- `NODE_ENV !== 'production'`, **or**
- `SEED_DEMO_USERS=true` is explicitly set.

Never set `SEED_DEMO_USERS=true` in production.

---

## Environment Variables

- All secrets in `.env` files — **never committed** (`.gitignore` covers `*.env`, `.env.*`).
- The API validates required vars at startup via `requireEnv()` in `main.ts` and exits with code 1 if any are missing.
- Required vars: `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`.

---

## HTTP Security Headers (Web)

Set globally in `next.config.mjs` via the `headers()` callback:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, mic, geolocation off |
| `Content-Security-Policy` | `default-src 'self'`; connects to same-origin + WebSocket |
| `Strict-Transport-Security` | 2-year max-age, includeSubDomains, preload |

---

## Rate Limiting

Handled by `@nestjs/throttler`:
- Global: **100 requests / 60 seconds** per IP (configurable via `THROTTLE_LIMIT_GLOBAL`).
- `/auth/refresh`: tighter limit via `@Throttle({ default: { ttl: 60_000, limit: 20 } })`.

---

## Known Accepted Risks

| Risk | Mitigation | Status |
|------|-----------|--------|
| Tokens lost on page reload (memory-only) | Re-login or silent refresh on load | Accepted — XSS protection outweighs UX cost |
| CSP `unsafe-inline` on scripts | Required by Next.js inline hydration scripts | Revisit with nonce-based CSP when Next.js supports it |
