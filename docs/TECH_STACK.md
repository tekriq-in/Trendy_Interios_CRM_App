# Tech Stack

> All version numbers reflect what is pinned in `package.json` files. Update this file whenever a major dependency is upgraded.

---

## Backend — `apps/api`

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | Server runtime |
| Framework | NestJS | ^10.3 | Modular REST API, DI, guards, interceptors |
| Database | MongoDB (Atlas) | — | Primary data store |
| ODM | Mongoose | ^8.2 | Schema definitions, validation, aggregation pipelines |
| Auth | Passport + `@nestjs/jwt` | ^10 / ^10.2 | JWT access + refresh tokens; local strategy for login |
| MFA | speakeasy + qrcode | ^2.0 / ^1.5 | TOTP-based MFA (mandatory for MD/GM/Head) |
| Real-time | Socket.IO (`@nestjs/websockets`) | ^4.8 | Chat gateway, project/dept/DM channels |
| Validation | class-validator + class-transformer | ^0.14 / ^0.5 | DTO validation with `ValidationPipe` |
| File upload | Multer | ^1.4-lts | Multipart form handling |
| Drive (prod) | `googleapis` | ^186 | Google Drive file upload and link generation |
| Drive (alt) | Cloudinary | ^2.11 | Alternative object storage provider |
| Cloud storage | `@google-cloud/storage` | ^8.4 | GCS bucket access |
| Push notifications | firebase-admin | ^14.5 | FCM push to mobile devices |
| Password hashing | bcrypt | ^5.1 | Secure credential storage |
| Rate limiting | `@nestjs/throttler` | ^6.7 | API abuse protection |
| Security headers | helmet | ^8.3 | HTTP security headers |
| Scheduling | `@nestjs/schedule` | ^12.0 | Cron jobs (e.g. SLA checks) |
| Events | `@nestjs/event-emitter` | ^2.0 | Decoupled internal events |
| Language | TypeScript | ^5.4 | Strict mode; no `any` |
| Testing | Jest + `@nestjs/testing` | ^29.7 | Unit and E2E tests |

### API conventions

- One NestJS module per domain in `src/modules/`
- Guard chain: `JwtAuthGuard` → `PermissionsGuard` → `ProjectScopeGuard`
- All MongoDB queries scoped with `{ assignedTeam: { $in: [userId] } }` for Employee role
- Populate replaced with `$lookup` aggregation pipelines to avoid Mongoose silent failures
- Activity log recorded after every create, update, approval, and status change

---

## Frontend — `apps/web`

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Framework | Next.js | ^14.2 | App Router, SSR/CSR hybrid |
| Language | TypeScript | ^5.4 | Strict mode |
| Styling | Tailwind CSS | ^3.4 | Utility-first CSS |
| State | Zustand | ^4.5 | Auth store (JWT, user object) |
| Server state | TanStack Query v5 | ^5.32 | API caching, mutations, invalidation |
| HTTP | Axios | ^1.6 | API client with interceptor for JWT |
| Real-time | socket.io-client | ^4.8 | Chat and live notifications |
| Charts | Recharts | ^3.10 | Dashboard analytics (Bar, Pie, Area) |
| Icons | Lucide React | ^1.53 | Consistent icon library |
| i18n | next-intl | ^3.13 | English + Tamil localisation |
| Cookies | js-cookie | ^3.0 | httpOnly JWT cookie helper |
| E2E tests | Playwright | ^1.64 | Browser-level integration tests |

### Web conventions

- App Router (`app/` directory); no Pages Router
- Server components for data layout; client components for interactivity
- Form validation: per-field `fieldErrors` state with red-border highlighting
- API errors handled: `Array.isArray(msg) ? msg.join(', ') : msg`

---

## Mobile — `apps/mobile`

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Expo (React Native) | Cross-platform iOS/Android |
| Navigation | Expo Router | File-based navigation |
| State | Redux Toolkit + Redux Persist | Global state + offline persistence |
| HTTP | Axios | API client |
| Real-time | socket.io-client | Chat and notifications |
| i18n | i18next + react-i18next | English + Tamil |
| Push | Expo Notifications + FCM | Device push notifications |

### Mobile conventions

- Minimum tap target: 48 × 48 dp (site/factory workers)
- Offline queue: tasks and photos created offline are synced on reconnect
- Dates displayed in IST (`Asia/Kolkata`) via `date-fns-tz`

---

## Shared — `packages/shared`

| Export | Contents |
|---|---|
| `PERMISSIONS` | All 30+ permission slug constants |
| Types | `User`, `Project`, `Role`, `Department`, etc. |
| Constants | Currency helpers (INR, 2 d.p.), stage weights |

---

## Infrastructure

| Service | Used for |
|---|---|
| MongoDB Atlas | Hosted database (free tier → scale up) |
| Google Drive API | Production file storage with shared drive links |
| Cloudinary | Alternative/fallback object storage |
| Firebase Cloud Messaging | Mobile push notifications |
| WhatsApp Business API (Meta) | Client messaging (approval-gated) |
| Groq (LLaMA 3.3 70B) | AI message drafting in English and Tamil |

---

## Development tooling

| Tool | Purpose |
|---|---|
| pnpm workspaces | Monorepo package management |
| Turborepo | Parallel build/dev task orchestration |
| ESLint | Code linting |
| TypeScript (`tsc --noEmit`) | Type checking across all apps |
