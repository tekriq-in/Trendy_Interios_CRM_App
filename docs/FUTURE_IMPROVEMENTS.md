# Future Improvements

> This document tracks planned enhancements, known limitations, and long-term roadmap items.  
> Items are grouped by area and prioritised within each group.

---

## P0 — Must have before production launch

### Testing
- [ ] Write and pass all three critical spec files:
  - `apps/api/test/permission-scoping.spec.ts` — Employee cannot read un-assigned projects
  - `apps/api/test/approval-gate.spec.ts` — WhatsApp not called without approved approval
  - `apps/api/test/handover-rules.spec.ts` — Handover without proof files → 400
- [ ] Add unit tests for `ApprovalsService` message generation and Tamil translation
- [ ] E2E test covering login → create project → raise blocker flow

### Mobile
- [ ] Offline task creation queue (Redux middleware → sync on reconnect)
- [ ] Photo upload from mobile camera with progress indicator
- [ ] FCM push notification display for approval requests and stage changes

### API completeness
- [ ] SLA timer: cron job that automatically flags stages that have exceeded `defaultSlaHours`
- [ ] Project `progressPct` recalculation on task completion and stage change
- [ ] Payments: overdue follow-up engine (`GET /payments/overdue`)

---

## P1 — High value improvements

### Dashboard & Analytics
- [ ] Time-series chart: project completion trend over months (requires storing `completedAt` on projects)
- [ ] Export dashboard data to CSV / PDF
- [ ] Per-department SLA compliance rate (% of stages completed on time)
- [ ] Revenue tracking chart (advance + periodic + final payments per month)

### Approval workflow
- [ ] Approval history timeline on each approval card (requested → reviewed → approved/rejected)
- [ ] Bulk approve/reject multiple approvals in one action
- [ ] Configurable approval templates per message type (quotation, update, order confirmation)
- [ ] Email fallback when WhatsApp delivery fails

### Projects
- [ ] Project timeline Gantt view (stage durations, target vs actual)
- [ ] Additional work log with client notification and revised quotation generation
- [ ] Project duplication (clone settings and team from a previous project)
- [ ] Project archiving (soft delete with restore)

### Clients
- [ ] Client portal: read-only view link sent to client to track their project progress
- [ ] Client import from CSV
- [ ] Duplicate phone number detection at creation

### Chat
- [ ] Message read receipts (show "seen by" under each message)
- [ ] File/image preview in chat before sending
- [ ] Message reactions (emoji)
- [ ] Notification badge count on chat tab icon

---

## P2 — Nice to have

### Mobile
- [ ] Dark mode support
- [ ] Biometric login (FaceID / fingerprint) after initial JWT setup
- [ ] QR code scanner for project handover confirmation on-site
- [ ] Voice note recording and sending in chat

### Web UI
- [ ] Drag-and-drop task reordering within a department
- [ ] Calendar view for project deadlines and SLA due dates
- [ ] Dark mode toggle
- [ ] Keyboard navigation audit (all modals trapfocus, escape closes)

### Notifications
- [ ] In-app notification centre (bell icon with count badge)
- [ ] Notification preferences per user (which events trigger a push)
- [ ] Daily digest email for MD/GM: pending approvals + open blockers

### Roles & Permissions
- [ ] Permission diff view when editing a role (show what changed)
- [ ] Role cloning (copy permissions from an existing role as starting point)
- [ ] Audit trail for role permission changes in activity log

### Documents
- [ ] Document version history (replace a file, keep old versions)
- [ ] Drawing review workflow (upload → mark-up → approve)
- [ ] Bulk document download as ZIP

---

## P3 — Long-term / Phase 4 roadmap

### Insights
- [ ] Full analytics module: stage conversion rates, average project duration, client retention
- [ ] SLA breach root-cause tagging (weather, client delay, supplier, internal)
- [ ] Team performance report: tasks completed per person per month
- [ ] Revenue forecasting based on project pipeline

### Platform
- [ ] Multi-tenancy: support multiple interior studios from one deployment
- [ ] White-label theming: studio name and logo in env config
- [ ] Webhook outbound: notify external systems (accounting, ERP) on project events
- [ ] API rate limiting per client (separate from global throttle)

### AI enhancements
- [ ] Auto-summarise project activity log for the MD weekly briefing
- [ ] Suggest next action based on project stage (e.g., "Measurement done — schedule design review")
- [ ] AI-powered blocker categorisation and suggested resolution steps
- [ ] Multi-language support beyond Tamil (Hindi, Kannada)

### Mobile
- [ ] Standalone offline mode: full project detail readable without internet
- [ ] Mobile push for chat messages
- [ ] Android widget for pending tasks

---

## Known limitations (current)

| Limitation | Workaround | Tracking |
|---|---|---|
| `progressPct` is not auto-recalculated on task change | Manually update or refresh | P0 |
| FCM push not sending real notifications | Mock logs to console | P0 |
| No SLA timer — breach detection is manual | MD reviews SLA report on dashboard | P0 |
| Chat message history pagination not implemented | All messages returned in one request | P1 |
| Mobile offline sync queue not implemented | Tasks created offline are lost on close | P0 |
| `activity_log` has no UI pagination | Only 50 most recent shown | P2 |

---

## Completed (recent)

- [x] Department card click-through detail popup (SLA, staff, projects, breaches)
- [x] Dashboard 4-chart insights (Project Status, SLA Performance, Workload, Completion Trend)
- [x] Roles page redesign with grouped permissions and Select All per group
- [x] Department reactivation flow (Show Inactive toggle + Activate button)
- [x] Employee reactivation (Activate button for inactive users)
- [x] Add Member panel in chat for all group types
- [x] Department groups visible to all users; join/leave for any group
- [x] New DM flow in chat
- [x] Tamil rawNotes translation in approval message drafting
- [x] Form validation (clients, users, login) with per-field errors and red borders
- [x] Blocker description made optional (was causing 500 on submit)
- [x] Handover project name displayed on handover cards
- [x] File upload via Google Drive and Cloudinary
