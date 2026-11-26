# Suggestions for the Trendy Interios CRM app

Written after reviewing the merged `dev-env` code (2026-11-27). This is a read-through of the code, not a run on a device, so UI points come from the code rather than from using the app.

## What is already solid

- Helmet, rate limiting, request validation, upload size limits, and no tokens in web local storage.
- Project isolation is enforced on tasks, handovers, blockers and chat, with tests.
- Mobile tokens are in secure storage, and there are 168 API tests.

## Do first (affects real use)

1. **Monitoring.** Nothing watches the live app, so crashes and slow requests on Render are invisible. Add Sentry or similar for API, web and mobile, plus an uptime ping. The free Render plan sleeps when idle, so a ping also avoids the 30-60 second first request.
2. **Pagination.** Only 4 modules limit their results (activity-log, approvals, dashboard, messages). Lists of projects, tasks, clients, handovers and chat will get slow as data grows. Add `page`/`limit` to the list endpoints and infinite scroll on mobile.
3. **Untested modules.** `notifications`, `shade-card` and `webhooks` have no tests. The webhook is the entry point for client WhatsApp messages. `approvals` and `purchase-items` have only light coverage. These sit next to the approval gate, the most important business rule.
4. **Try the Gopika merge in the real app.** Nothing has run end to end yet: admin password reset, forced change on mobile, bulk delete with `DELETE ALL`. Do a manual run-through before promoting `dev-env`.
5. **Credentials.** The Mongo, Cloudinary and JWT secrets were shared in chat earlier. Rotate them before real data goes in. Also set `CORS_ORIGIN` on Render to the Vercel URL.

## Product gaps

6. **Mobile has no screens for approvals, clients, shade cards or SLA.** The web has all of them. If MD/GM approve on the phone, an approvals screen is the biggest gap.
7. **Push notifications.** There is a `notifications` module with no tests and no sign it is wired end to end. For site staff, "you were assigned a task" and "approval decided" alerts matter most.
8. **Offline photos.** The offline queue covers actions, but handover proof photos need a visible "waiting to upload" state with retry.
9. **Change-password screen on mobile** still has the old styling. Restyle it with the new UI kit.

## UI/UX polish

10. **Translations.** Mobile has about 6 hard-coded English strings. The web has only 17 translation keys in each language, so most web screens are probably English only. Tamil support is a stated requirement, so audit both.
11. **Accessibility.** Mobile has only 39 accessibility labels across about 20 screens. Icon-only buttons need labels, and the 48dp tap target rule should be checked screen by screen.
12. **Web on a phone.** The web has 17 dashboard pages. The org chart, SLA and roles pages are the most likely to be awkward on a small screen.
13. **Empty and error states.** Check that every list shows a friendly message and a retry button when empty or offline, the way the mobile ones now do.

## Engineering hygiene

14. **CI.** `dev-env` has no CI by choice, so a bad merge there only shows up when promoted. A cheap compromise is a CI run on the `dev-env` to `dev` promotion PR.
15. **Mobile and web tests.** There are only 14 test files outside the API. A few for login, the offline queue and the password-change redirect would catch the bugs that were fixed by hand earlier.
16. **Stale remote branches.** Merged branches such as `security/api-project-scoping`, `chore/agent-pipeline` and `docs/pr-target-rule` can be deleted.
17. **Leftover worktree folders.** `wt-agents`, `wt-api` and `wt-docs` can be removed.

## Suggested order

Rotate credentials, run the Gopika flow in the app, then monitoring, pagination and tests for the three untested modules. After that, the mobile approvals screen and push notifications, then the Tamil and accessibility audit.
