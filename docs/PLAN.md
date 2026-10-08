# Trendy Interiors CRM — Implementation Plan

## 1. Monorepo Structure

```
trendy-interiors/
├── apps/
│   ├── api/          # NestJS REST API + Socket.IO
│   ├── web/          # Next.js admin dashboard
│   └── mobile/       # Expo (React Native) staff app
├── packages/
│   └── shared/       # TypeScript types, permission slugs, constants
├── docs/
│   ├── SOW.md
│   └── PLAN.md
├── CLAUDE.md
├── package.json      # Turborepo + pnpm workspace root
├── turbo.json
└── pnpm-workspace.yaml
```

**Tooling:** pnpm workspaces + Turborepo. Node 20 LTS.

---

## 2. Mongoose Schemas

All schemas share base fields via a plugin: `createdAt`, `updatedAt`, `createdBy: ObjectId ref users`.

### departments
```ts
{ name, description, order, isActive, defaultSlaHours }
```

### users
```ts
{ name, email, phone, passwordHash, role, department, reportsTo,
  assignedProjects[], fcmToken, mfaEnabled, mfaSecret, isActive, preferredLanguage }
```

### roles
```ts
{ name, permissions[], isSystem }
```

### clients
```ts
{ name, phone, email, location (GeoJSON Point), address, leadSource,
  referredBy, notes, whatsappOptIn }
```

### projects
```ts
{ client, title, currentStage, stageHistory[], progressPct, stageWeights Map,
  assignedTeam[], targetDate, status, advance, advancePaidAt,
  requiresDrawing, additionalWork[] }
```

### tasks
```ts
{ project, department, title, description, assignedTo, status,
  dueDate, completedAt, offlineCreatedAt, photos[] }
```

### handovers
```ts
{ project, fromDepartment, toDepartment, raisedBy, confirmedBy, acceptedBy,
  status (draft|confirmed|accepted|rejected), rejectionReason, proofFiles[], notes }
```

### purchaseItems
```ts
{ project, item, description, quantity, unit, supplier,
  status (pending|ordered|received), orderedAt, receivedAt, linkedDocument }
```

### blockers
```ts
{ project, raisedBy, title, description, type (internal|client_side),
  status (open|sla_triggered|resolved), slaTriggeredAt, slaTriggeredBy,
  resolvedAt, resolvedBy }
```

### approvals
```ts
{ project, kind (quotation|order_confirmation|client_update|drawing),
  requestedBy, approver, status (pending|approved|rejected),
  rejectionReason, linkedDocument, approvedAt, whatsappScheduled }
```

### payments
```ts
{ project, kind (advance|periodic|final), amount, paidAt,
  collectedBy, notes, followUpSentAt, followUpApprovedBy }
```

### documents
```ts
{ project, driveFileId, driveLink, mimeType, fileName, fileSize,
  version, type, uploadedBy, department }
```

### messages
```ts
{ channel, sender, body, attachments[], readBy[] }
```

### slaSettings
```ts
{ department, defaultHours, updatedBy }
```

### activityLog (append-only)
```ts
{ actor, action, entity, entityId, metadata }
```

---

## 3. API Endpoints (`/api/v1`)

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Email+password, returns access + refresh tokens |
| POST | /auth/refresh | Rotate refresh token |
| POST | /auth/logout | Revoke refresh token |
| POST | /auth/mfa/setup | Initiate TOTP setup |
| POST | /auth/mfa/verify | Verify TOTP |

### Users & Roles
`GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `GET /users/org-chart`
`GET/POST /roles`, `PATCH/DELETE /roles/:id`

### Departments
`GET/POST /departments`, `PATCH/DELETE /departments/:id`

### Clients
`GET/POST /clients`, `GET/PATCH /clients/:id`

### Projects
`GET/POST /projects`, `GET/PATCH /projects/:id`
`POST /projects/:id/advance-stage`, `GET /projects/:id/progress`
`POST /projects/:id/additional-work`

### Tasks
`GET/POST /projects/:id/tasks`, `PATCH/DELETE /tasks/:id`

### Handovers
`POST /handovers`
`PATCH /handovers/:id/confirm` (from-dept lead)
`PATCH /handovers/:id/accept` (to-dept lead)
`PATCH /handovers/:id/reject` (to-dept lead, with reason)

### Purchase Items
`GET/POST /projects/:id/purchase-items`, `PATCH /purchase-items/:id`

### Blockers
`GET/POST /blockers`
`PATCH /blockers/:id/trigger-sla` (MD only)
`PATCH /blockers/:id/resolve`

### Approvals
`GET/POST /approvals`
`PATCH /approvals/:id/approve`, `PATCH /approvals/:id/reject`

### Payments
`GET/POST /projects/:id/payments`, `GET /payments/overdue`

### Documents
`POST /documents/upload`, `GET/DELETE /documents/:id`

### SLA / Activity / Dashboard
`GET/PATCH /sla`, `GET /activity-log`
`GET /dashboard/board`, `/dashboard/workload`, `/dashboard/blockers`, `/dashboard/approvals-pending`

### Socket.IO Events
`join_channel`, `message` (both directions), `notification`, `handover_update`, `project_progress`

---

## 4. Permission Matrix

### Slugs
```
users:read/create/edit/delete
roles:read/create/edit/delete
departments:read/create/edit/delete
clients:read/create/edit
projects:read_all/read_own/create/edit/advance_stage
tasks:create/edit/delete
handovers:raise/confirm_from/accept_to
purchase_items:manage
blockers:raise/trigger_sla/resolve
approvals:request/decide
payments:record/view_all
documents:upload/delete
messages:send
activity_log:read
sla:edit
dashboard:view
whatsapp:send_approved   ← system-only, never assignable to users
```

### Default Role Assignments (configurable, not hard-coded)

| Permission | MD | GM | Head | Employee |
|------------|----|----|------|----------|
| users:read | ✓ | ✓ | own dept | — |
| users:create/edit | ✓ | ✓ | — | — |
| users:delete | ✓ | — | — | — |
| roles:* | ✓ | — | — | — |
| departments:* | ✓ | ✓ | — | — |
| clients:read | ✓ | ✓ | ✓ | assigned |
| projects:read_all | ✓ | ✓ | — | — |
| projects:read_own | ✓ | ✓ | ✓ | ✓ |
| projects:create/edit | ✓ | ✓ | — | — |
| projects:advance_stage | ✓ | ✓ | ✓ | — |
| tasks:create/edit | ✓ | ✓ | ✓ | assigned |
| tasks:delete | ✓ | ✓ | ✓ | — |
| handovers:raise | ✓ | ✓ | ✓ | ✓ |
| handovers:confirm_from | ✓ | ✓ | own dept | — |
| handovers:accept_to | ✓ | ✓ | own dept | — |
| blockers:raise | ✓ | ✓ | ✓ | ✓ |
| blockers:trigger_sla | ✓ | — | — | — |
| approvals:decide | ✓ | ✓ | — | — |
| activity_log:read | ✓ | ✓ | — | — |
| sla:edit | ✓ | — | — | — |

### Server-side Enforcement Rules
1. `projects:read_own` → query ANDed with `{ assignedTeam: { $in: [userId] } }`
2. No endpoint allows staff to send client messages without `approvals:decide` gate
3. WhatsApp sends triggered only by approval service after status = `approved`
4. `whatsapp:send_approved` is system-only and not assignable to any user role
5. Handover POST requires `proofFiles.length >= 1` (server validates)
6. MFA enforced at guard level for any role with `approvals:decide` or `blockers:trigger_sla`

---

## 5. Phase Breakdown

| Phase | Deliverables |
|-------|-------------|
| 1 — Core | Monorepo, shared types, NestJS API (all modules, schemas, guards), Next.js admin dashboard, Expo mobile (auth + projects + tasks + offline), Drive stub, tests |
| 2 — Collaboration | Socket.IO chat, handover flow, blockers, FCM push, offline sync |
| 3 — Automation | Approval gate, WhatsApp integration, payment follow-up engine |
| 4 — Insight | Analytics, SLA reporting, audit log UI |

---

## 6. Key Implementation Notes

- **Tests (must pass before Phase 1 complete):**
  - `test/permission-scoping.spec.ts` — Employee cannot read un-assigned projects
  - `test/approval-gate.spec.ts` — No WhatsApp message without approved approval
  - `test/handover-rules.spec.ts` — Handover without proof files → 400
- **Drive stub:** `DriveService` provider; `DRIVE_PROVIDER=mock` (default) writes to `/tmp/drive-mock/`; `=google` activates real
- **WhatsApp stub:** same pattern; `WHATSAPP_PROVIDER=mock` logs to console; `=meta` activates real
- **i18n:** `i18next` on mobile + web; API returns error keys (not translated)
- **Currency:** amounts in INR (store as Number with 2dp); standardised in `packages/shared/src/constants/currency.ts`
- **Dates:** stored UTC, displayed as IST (Asia/Kolkata)
- **Progress bar:** recomputed async via NestJS event listener on task/stage changes; weights seeded per dept, per-project override via `stageWeights` map
