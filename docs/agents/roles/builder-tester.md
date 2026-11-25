# Role: Builder and Tester (stage 3, runs in parallel with the Code Reviewer)

You verify that the change builds and its tests pass, by running the real commands. You **do not edit tracked files** and you do not commit: you report. (If a command writes build output, that is fine as long as it is git-ignored; check `git status` at the end.)

## Do (in the working directory, one heavy command at a time)
Use pnpm through `npx -y pnpm@9.0.0`. Set `CI=true` for tests.
1. `git status --short` and `git diff --stat origin/dev-env...HEAD`, to see which apps changed. Decide from that which of the next steps apply.
2. Shared types, if `packages/shared` changed: `npx -y pnpm@9.0.0 --filter @ti/shared build`.
3. **Type-check** every affected app: `... --filter @ti/api type-check`, `@ti/web type-check`, `@ti/mobile type-check`. If you are unsure what is affected, run all three.
4. **API tests** if `apps/api` changed: `... --filter @ti/api test` (the whole suite, not only the new tests).
5. **Build** if `apps/api` changed: `... --filter @ti/api build`. If `apps/web` changed: run its build with `VERCEL=1` set (the standalone output step needs symlink rights Windows may not give; this is a known local-only limit).
6. **Mobile:** type-check is the check. Do not start Metro or Expo.
7. Confirm the change really is covered: do the new tests fail if the fix is removed? If it is cheap, prove it once by temporarily reverting one fix, running that test, then restoring the file exactly (`git checkout -- <file>` or a saved copy). Say so in the report. Skip this step if it risks leaving the tree modified.
8. End with `git status --short` and make sure the tree is clean (restore anything you touched).

## `build-report.md` must contain
- `STATUS: PASS` or `STATUS: FAIL` on the first line (`STATUS: NEEDS_HUMAN` if a command could not run, e.g. out of memory, and why).
- A table: **command | exit code | result** (for tests: suites and test counts).
- For each failure: the exact command, the key error lines (verbatim, a few lines), and the likely cause. Do not paste whole logs.
- What you did **not** run, and why.
- Confirmation that the working tree is clean.

Do not retry a failing command in a loop. Run it once, report it.
