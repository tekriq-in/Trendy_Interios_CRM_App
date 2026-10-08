# Statement of Work — Trendy Interios Workflow System
**Client:** Trendy Interios | **Prepared by:** Tekriq Technologies

---

## 1. What We Are Building

A system that tracks every interior-manufacturing project end to end, department by department, replacing a paper register and a Google Sheet.

1. **Staff mobile app** (React Native, Android + iOS)
2. **Admin web dashboard** (React / Next.js) for MD, GM and admins
3. **Backend API** (Node.js + NestJS, REST) used by both

---

## 2. Fixed Tech Decisions

| Concern | Decision |
|---------|----------|
| Database | MongoDB Atlas (Mongoose). No row-level security → enforce data isolation in API: every Employee query scoped to their assigned projects. Write automated tests for this. |
| File storage | Google Drive via API. New GCP project + service account. Staff never touch Drive. Backend uploads into Client > Project > Department folders and stores Drive file ID, link and metadata in MongoDB. |
| Chat | WebSockets (Socket.IO) — 1:1, project and department channels, photo and document sharing. |
| Push notifications | Firebase Cloud Messaging (FCM). |
| Client messaging | WhatsApp Business API directly (no Twilio). Pre-approved templates, queue and retry. |
| Auth | JWT + refresh tokens. MFA mandatory for MD, GM and Department Heads. |
| Secrets | Environment variables / secrets manager only. Never in client code. |
| Languages | English and Tamil (i18n from day one). Currency INR, Indian date formats (IST). |
| Offline | Mobile must work offline: capture status and photos, queue uploads, sync and retry on reconnect. |
| UX | Staff may use own or company devices. UI must be simple for non-technical factory/site workers: large tap targets, minimal typing. |

---

## 3. Project Workflow — Eight Departments (In Order)

1. **Enquiry (Sales):** Client arrives via marketing or referral. Collect location share, time schedule, interior requirements, showroom visit, shared details and ideas. Schedule next meeting at site or factory.
2. **Measurement:** Site visit and measurement per client requirement; order details filled.
3. **Design (with Sales):** Design team prepares quotation (revisable). MD must approve before sharing with client, and again for order confirmation. Advance collected and recorded. Material and hardware approvals with client (laminate, acrylic, veneer, handles, glass, baskets & accessories, decoration products). 2D drawing COMPULSORY, 3D optional. Client approves final drawing. Area-wise priority passed to design.
4. **Purchase:** Orders materials and goods. Item-level status (ordered / received / pending). All items received → stage completes; otherwise only pending items stay open.
5. **Manufacturing:** Production starts; status updates with photos.
6. **Assembly:** Assembly done; records updated.
7. **Delivery:** Separate team, before cleaning and handover.
8. **Final Clean and Handover:** Project handed over; final payment followed up; MD closes the project.

---

## 4. Cross-Cutting Rules

### Handovers
- Employee raises → their team lead confirms → receiving team's lead accepts and starts work.
- Rejection returns to sender with a reason.
- A handover **cannot** be raised without photo proof uploaded (stored in Google Drive).

### Project Readiness Bar
- Progress percentage rises as stages and sub-tasks complete.
- Shown in the app and on the dashboard.
- Per-stage weights configurable.

### Additional Work Mid-Project
- Logged against the project; amount informed to client.
- Design looped in if a drawing is needed; production notified.
- Must not disturb the main stage flow.

### Payments
- Advance, periodic, and final payments tracked per project.
- Follow-up reminders: staff push notification; client WhatsApp nudge where appropriate.

### Blockers
- Any team can raise one, tagged internal or client-side.
- Goes to team lead and shows on MD/admin dashboard.
- Escalation is **MANUAL**: MD or admin decides whether to trigger SLA.
- SLA hours configurable per stage, editable at any time.
- Client-side blockers produce a WhatsApp message **only** through the approval gate.

### Client Communication
- **NOTHING** reaches a client unless an MD or GM approves it, or a fixed rule configured by the MD fires (e.g. payment reminders).
- No path exists for an employee to message a client directly.

---

## 5. Roles and Access

| Role | Level |
|------|-------|
| MD | Super admin |
| GM | General manager |
| Department Head / Team Lead | Dept-level management |
| Employee | Field / factory worker |

- Role permissions are **configurable, not hard-coded**. Enforced server-side.
- Employees see only assigned projects and tasks.
- Departments, teams, users, team leads and reporting lines are **NOT fixed** — the MD/admin manages them in the dashboard.
- The stage flow must be **data-driven**, not hard-coded (seed the eight departments as defaults).
- Every user has a role and `reports_to`, forming the org chart (MD > GM > Head > Employee).

---

## 6. Core Data Model (MongoDB Collections)

| Collection | Key Fields |
|------------|------------|
| departments | name, order, isActive, defaultSlaHours |
| users | role, department, reportsTo, assignedProjects, mfaEnabled |
| roles | name, permissions[], isSystem |
| clients | leadSource, location, contact, whatsappOptIn |
| projects | client, stage, progressPct, targetDate, assignedTeam |
| tasks | project, dept, assignedTo, status, photos |
| handovers | fromDept, toDept, raisedBy, confirmedBy, acceptedBy, status, reason, proofFiles |
| purchaseItems | project, item, status (ordered/received/pending) |
| blockers | type (internal/client_side), status, raisedBy |
| approvals | project, kind (quotation/orderConfirmation/clientUpdate/drawing), status, approver |
| payments | project, kind (advance/periodic/final), amount INR |
| documents | driveFileId, driveLink, version, type |
| messages | channel, sender, body, attachments |
| slaSettings | department, defaultHours |
| activityLog | actor, action, entity, entityId, metadata (append-only) |

All documents carry `createdAt`, `updatedAt`, `createdBy`. The activity log is append-only and readable only by MD and GM.

---

## 7. Admin Dashboard Must Include

- Projects by stage (board and list views) with readiness bars
- Pending approvals queue
- Open blockers with trigger-SLA action
- Overdue payments
- Team workload
- Department / user / team-lead management (add, edit, remove)
- SLA settings (per stage, editable)
- Role configuration
- Activity log

---

## 8. Out of Scope

- Online payment gateway
- Client login portal
- Accounting / GST integration (Tally / Zoho)
- Data migration (system starts empty)
- 3D design tooling

---

## 9. Build Phases

| Phase | Scope |
|-------|-------|
| Phase 1 — Core | Users, roles, org chart, dynamic departments, client CRM, data-driven stage tracking, tasks, readiness bar, Google Drive uploads, admin dashboard, activity log |
| Phase 2 — Collaboration | Chat, handover flow, blockers, push notifications, offline mode |
| Phase 3 — Automation | Approval gate, WhatsApp Business API, payment tracking and follow-up engine |
| Phase 4 — Insight | Analytics, reports, SLA tools, audit review |

---

## 10. Non-Functional Requirements

- Tests for: permission scoping, approval gate (no client message without approval), handover rules (proof required).
- `.env.example` files; no committed secrets.
- Drive and WhatsApp behind interfaces with local mocks (`DRIVE_PROVIDER`, `WHATSAPP_PROVIDER` env flags).
- SLA defaults seeded at sensible values; fully editable in dashboard.
