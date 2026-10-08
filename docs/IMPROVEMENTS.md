# Trendy Interios CRM — Improvement Roadmap

> Last updated: 2026-10-09  
> Branch: `dev`  
> All items below are post-Phase-3 (approval gate + AI messaging is done).

---

## Current System Status

| Area | Status | Notes |
|------|--------|-------|
| Web UI — all pages | ✅ Done | Dashboard, Clients, Projects, Departments, Roles, Users, Handovers, Approvals, Blockers, SLA, Activity Log |
| Mobile screens | ✅ Done | Login, Projects, Tasks, Blockers, Profile, Project Detail, Client Onboarding |
| API modules | ✅ Scaffolded | All modules exist; some service methods are stubs |
| Auth / JWT | ✅ Working | Access + refresh tokens, guards in place |
| Approval gate + AI messaging | ✅ Done | Gemini Flash / Groq / mock, editable preview, WhatsApp send |
| Real-time chat (Socket.IO) | ⚠️ Gateway only | Not wired in web or mobile UI |
| Push notifications (FCM) | ⚠️ Scaffolded | Not sending real notifications |
| Document upload | ⚠️ Drive mock ready | No upload UI in web or mobile |
| Offline sync (mobile) | ⚠️ Redux setup | Queue logic not implemented |
| Required test files | ❌ Missing | 3 spec files need writing and passing |
| SLA escalation | ❌ Missing | No timer or alert logic |
| API end-to-end (real DB) | ❌ Partial | Several service methods return stubs |

---

## Improvement Track A — API End-to-End (Production Ready)

Make the entire system work with real MongoDB data. Currently several service methods are scaffolded but return empty arrays or throw errors when no DB is connected.

### Tasks

- [ ] `ProjectsService.findAll()` — scope by `assignedTeam` for Employee role, return all for MD/GM
- [ ] `ProjectsService.advanceStage()` — validate handover exists and is `accepted` before moving stage
- [ ] `TasksService` — full CRUD with project + department scoping
- [ ] `BlockersService` — raise, trigger-SLA (MD only), resolve
- [ ] `DashboardService` — real aggregation queries (board, workload, stage durations)
- [ ] `UsersService` — create with bcrypt password hash, deactivate, role population
- [ ] `AuthService` — refresh token rotation with Redis or DB-stored token family
- [ ] `SeedService` — verify 8 departments, 4 roles, 1 MD user on first start
- [ ] Input validation — add `class-validator` DTOs to every controller
- [ ] Global error filter — consistent `{ message, code }` error shape
- [ ] Rate limiting — `@nestjs/throttler` on auth endpoints

### Env required
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=
JWT_REFRESH_SECRET=
```

---

## Improvement Track B — Real-time + Push Notifications

Make the app feel live: project chat, instant handover/approval notifications.

### Socket.IO Chat

- [ ] `MessagesGateway` — wire `join_channel`, `message` events (gateway exists, needs auth middleware)
- [ ] Web project detail page — add `<ProjectChat>` component (connect socket, show message history, send box)
- [ ] Mobile project detail — add chat tab alongside tasks
- [ ] Channel format: `project:<id>` for project chat, `dept:<id>` for department chat

### FCM Push Notifications

- [ ] `NotificationsService.sendToUser(userId, title, body)` — look up FCM token and send
- [ ] Trigger on: new approval request → notify MD/GM; handover raised → notify dept head; blocker raised → notify MD
- [ ] Mobile: `POST /notifications/register-token` called on login with Expo push token
- [ ] Fallback: in-app `notification` Socket.IO event when app is open

### Env required
```
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=
```

---

## Improvement Track C — Tests + Security Hardening

Three test files are required by the SOW before any phase is declared done.

### Required Test Files

#### `apps/api/test/permission-scoping.spec.ts`
```
- Create Employee user assigned to project A only
- GET /projects with Employee JWT → returns only project A, not project B
- GET /projects/:idOfProjectB → 403
```

#### `apps/api/test/approval-gate.spec.ts`
```
- Create a client_update approval in `pending` state
- Spy on WhatsAppService.sendMessage
- PATCH /approvals/:id/approve WITHOUT approvals:decide permission → 403, spy not called
- PATCH /approvals/:id/approve WITH permission → 200, spy called exactly once
- Verify approval record has whatsappScheduled: true
```

#### `apps/api/test/handover-rules.spec.ts`
```
- POST /handovers with no proofFileIds → 400
- POST /handovers with empty proofFileIds array → 400
- POST /handovers with valid proofFileIds → 201
```

### Additional Security

- [ ] MFA enforcement guard — block `approvals:decide` calls if `user.mfaEnabled === false`
- [ ] `whatsapp:send_approved` slug — confirm it is never returned by `GET /roles` and never assignable via `PATCH /roles/:id`
- [ ] Helmet + CORS config in `main.ts`
- [ ] Request size limit on file upload endpoints

---

## Improvement Track D — Document Upload + SLA

### Document Upload

- [ ] Web: file picker button on approval request modal → `POST /documents/upload` → stores Drive file ID
- [ ] Web: drawing upload on project detail page (type: `drawing_2d` / `drawing_3d`)
- [ ] Mobile: photo picker already exists on tasks — wire to `POST /documents/upload`
- [ ] Drive mock: write to `/tmp/drive-mock/<fileId>` with metadata JSON
- [ ] Google Drive real provider: swap via `DRIVE_PROVIDER=google` + service account JSON

### SLA Escalation

- [ ] `SlaService.checkOverdue()` — `@Cron('0 * * * *')` job every hour
- [ ] For each project in a stage longer than `department.defaultSlaHours`: emit `sla.breach` event
- [ ] `sla.breach` handler: create a blocker of type `internal` with `status: sla_triggered` automatically
- [ ] Dashboard SLA indicator: red badge on department card when any project is over SLA
- [ ] MD-only manual override: `PATCH /blockers/:id/trigger-sla`

---

## Improvement Track E — UI Polish + i18n

### Web

- [ ] Loading skeletons on all data-fetching pages (replace plain "Loading…" text)
- [ ] Empty state illustrations (SVG) for zero-data views
- [ ] Toast notifications for mutation success/error (replace silent failures)
- [ ] Breadcrumb navigation on project detail and nested pages
- [ ] Dark mode support (Tailwind `dark:` classes, respects OS preference)

### Mobile

- [ ] Tamil language strings — `apps/mobile/src/i18n/ta.json` is empty; fill all keys
- [ ] Offline indicator banner — show "Working offline" when `NetInfo.isConnected` is false
- [ ] Offline task queue — created/updated tasks while offline stored in Redux, synced on reconnect
- [ ] Pull-to-refresh on all list screens
- [ ] Haptic feedback on task complete and handover submit

---

## Priority Order (Recommended)

```
1. Track C — Tests           (SOW requirement; must be green before phase is done)
2. Track A — API end-to-end  (nothing works without real data)
3. Track B — Real-time       (biggest UX lift once data flows)
4. Track D — Documents + SLA (fills remaining SOW features)
5. Track E — Polish + i18n   (last mile before client demo)
```

---

## Quick Wins (can do anytime, < 1 hour each)

| Item | File | Change |
|------|------|--------|
| Toast on approve/reject | `approvals/page.tsx` | Add a simple toast state |
| Sidebar active dot for pending approvals count | `Sidebar.tsx` | Badge from `useQuery` |
| Mobile Tamil strings | `mobile/src/i18n/ta.json` | Fill translation keys |
| Helmet in API | `main.ts` | `app.use(helmet())` |
| `.env` seed email fix | `.env.example` | `admin@trendyinterios.in` (was `trendyinteriors`) |
