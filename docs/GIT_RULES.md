# Git Rules & Regulations — Trendy Interios CRM

Source of truth for branching strategy, commit conventions, and merge workflow across all contributors.

---

## Branch Strategy

| Branch | Purpose | Who pushes |
|--------|---------|-----------|
| `main` | Production-ready code. Never commit directly. | Merge via PR only |
| `dev` | Integration branch. All feature branches merge here first. | Merge via PR only |
| `feat/<ticket-or-slug>` | New feature | Developer |
| `fix/<ticket-or-slug>` | Bug fix | Developer |
| `chore/<slug>` | Non-functional work (deps, config, docs) | Developer |
| `hotfix/<slug>` | Urgent production fix branched from `main` | Lead only |

### Rules
- **Never force-push `main` or `dev`.**
- Feature/fix branches must branch off `dev`, not `main`.
- Delete the remote branch after it merges.
- One logical unit of work per branch — don't batch unrelated changes.

---

## Commit Message Convention

Format follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body — what and why, not how]

[optional footer: Co-Authored-By, Closes #issue]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature visible to users or callers |
| `fix` | Bug fix |
| `chore` | Maintenance — deps, build config, tooling |
| `refactor` | Code restructuring with no behaviour change |
| `test` | Adding or fixing tests only |
| `docs` | Documentation only |
| `style` | Formatting, whitespace — no logic change |
| `perf` | Performance improvement |
| `ci` | CI/CD pipeline changes |

### Scopes (common)

`api`, `web`, `mobile`, `shared`, `auth`, `projects`, `clients`, `approvals`, `chat`, `drive`, `sla`, `docs`

### Summary rules
- Imperative mood: "add reactivate endpoint" not "added" or "adds"
- ≤ 72 characters on the first line
- No period at the end of the summary line
- Lowercase after the colon

### Good examples
```
feat(api): add PATCH /clients/:id/reactivate endpoint
fix(approvals): correct ref name Document → TIDocument in schema
fix(chat): replace populate().lean() with $lookup aggregation
fix(documents): use explicit ObjectId cast in findByProject query
feat(approvals): translate rawNotes to Tamil when language=ta
```

### Bad examples
```
Fixed stuff                          ← no type, no scope, vague
feat: updated the clients page.      ← period, past tense
WIP                                  ← never commit WIP to dev/main
fix(api): Fixed the bug in the thing ← past tense, capitalised, vague
```

---

## Pull Request Rules

1. **PR title** follows the same `type(scope): summary` convention as a commit.
2. **Target branch** is always `dev` (never `main` directly, except hotfixes).
3. **PR description must include:**
   - What changed and why
   - How to test / what to verify
   - Screenshots for any UI change
4. **Minimum one approval** from a lead before merge.
5. **All CI checks must pass** (lint, type-check, tests) before merge.
6. **No self-merge** — the author cannot approve their own PR.
7. Resolve all review comments before merging; don't dismiss without a reply.
8. Squash-merge feature branches to keep `dev` history linear. Use merge commit only for hotfixes into `main`.

---

## Protected Files — Never Commit

| File / Pattern | Reason |
|----------------|--------|
| `.env` | Contains secrets |
| `.env.local`, `.env.*.local` | Local overrides with secrets |
| `*.pem`, `*.key`, `*.p12` | Private keys / certificates |
| `serviceAccount.json`, `*credentials*.json` | Service account keys |
| Any file containing a live API key, token, or password | Obvious |

Use `.env.example` with placeholder values instead. The `.gitignore` already blocks `.env` files — never use `--force` to push them past it.

---

## Commit Hygiene

- **One logical change per commit.** If the diff does two unrelated things, split into two commits.
- **Never commit `console.log` debug statements** to `dev` or `main`.
- **Run before committing:**
  ```bash
  pnpm lint          # must be clean
  pnpm type-check    # must be clean
  pnpm test          # must be green
  ```
- Use `git stash -u` to set aside unfinished work before switching branches.
- Keep `pnpm-lock.yaml` in sync — commit it alongside any `package.json` change.

---

## Merge Freeze

A merge freeze may be declared by the lead before a release cut. During a freeze:
- Only `hotfix/*` branches targeting `main` are allowed.
- All other PRs are queued and merge after the release is tagged.
- The lead announces the freeze in the project channel with a start and end time.

---

## Tagging & Releases

- Tags follow semantic versioning: `v<MAJOR>.<MINOR>.<PATCH>`
- Tags are created only on `main` after a successful release build.
- Use annotated tags: `git tag -a v1.2.0 -m "Release v1.2.0"`
- Push tags explicitly: `git push origin v1.2.0`

---

## Quick Reference

```bash
# Start a new feature
git checkout dev && git pull
git checkout -b feat/my-feature

# Sync with latest dev while working
git fetch origin && git rebase origin/dev

# Before opening a PR
pnpm lint && pnpm type-check && pnpm test

# Clean up after merge
git checkout dev && git pull
git branch -d feat/my-feature
git push origin --delete feat/my-feature
```
