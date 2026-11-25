# Multi-agent pipeline (Herdr + Claude Code)

A **lead** Claude session runs a request through six specialised **agents**, each a separate Claude session in its own [Herdr](https://herdr.dev) pane: plan, code, build and test, code review, raise the PR, review the PR.
Setup of Herdr itself, the skills and the Stop hook is in `docs/AGENT_WORKFLOW.md`. This file is the **configuration of the pipeline**. The machine-readable settings are in [`pipeline.json`](pipeline.json); the instructions each agent receives are in [`roles/`](roles).

```
request
   │
   ▼
 1 PLANNER ──► plan.md ──────────────────────────────┐
   │ (read-only)                                      │
   ▼                                                  │
 2 CODER ──► commits + coder-notes.md                 │   fix rounds (max 2):
   │ (the only stage that edits code)                 │   FAIL / CHANGES_REQUESTED
   ▼                                                  │   go back to the CODER,
 ┌─────────────────────┬──────────────────────┐       │   then stages 3 + 4 run again
 │ 3 BUILDER + TESTER  │  4 CODE REVIEWER     │ ◄─────┘
 │ build-report.md     │  review.md           │   (these two run at the same time = 2 agents)
 └──────────┬──────────┴───────────┬──────────┘
            └──── both PASS ───────┘
                      ▼
 5 PR RAISER ──► pushes the branch, opens ONE PR into dev-env ──► pr.md
                      ▼
 6 PR REVIEWER (fresh eyes) ──► GOOD: approval comment, PR left OPEN for you to merge
                           └──► NOT GOOD: comment with what to fix, then CLOSE the PR
```

## The agents

| # | Role | Edits code | Writes | Pass values |
|---|------|-----------|--------|-------------|
| 1 | Planner | no | `plan.md` | `READY`, `NEEDS_HUMAN` |
| 2 | Coder | **yes** (in its worktree) | commits, `coder-notes.md` | `DONE`, `NEEDS_HUMAN` |
| 3 | Builder and Tester | no | `build-report.md` | `PASS`, `FAIL`, `NEEDS_HUMAN` |
| 4 | Code Reviewer | no | `review.md` | `PASS`, `CHANGES_REQUESTED` |
| 5 | PR Raiser | pushes the branch | `pr.md`, opens the PR | `OPENED`, `BLOCKED`, `NEEDS_HUMAN` |
| 6 | PR Reviewer | no | `pr-review.md` | `APPROVED_OPEN`, `REJECTED_CLOSED` |

## Hard limits (enforced in every agent's prompt, and by the scripts where possible)

- **Pull requests go into `dev-env` only.** Never `dev` or `main`: agents have no rights to open PRs there. The PR Raiser must pass `--base dev-env` explicitly and confirm it afterwards.
- **No agent merges** anything, and no agent pushes to `dev`, `main` or `dev-env`.
- **Commits have no Claude co-author or attribution lines** (this repo's rule), use Conventional Commits, and never include `.env` files or secrets.
- **At most 2 agents run at once** (`maxConcurrentAgents`, the machine has limited memory): only stages 3 and 4 run in parallel. `herdr-stage.ps1` refuses to open a third pane.
- **One worktree per run** (`../wt-<slug>`), created from `origin/dev-env`. Agents never touch the main checkout, which may be serving a running dev server.
- **No dependency changes** by agents: the worktree shares the main checkout's `node_modules`. A needed dependency change stops the run with `NEEDS_HUMAN`.
- **Blocked agents ask you.** If an agent is waiting on a permission prompt the lead stops and asks; it never approves for you.
- **Fix rounds are capped** (`maxFixRounds`, 2). After that the lead stops and reports instead of looping.

## Review outcomes

| PR Reviewer verdict | Action |
|---|---|
| GOOD | one approval comment; **PR stays open** so a human merges it |
| NOT GOOD | one comment with the numbered must-fix list, then the **PR is closed** (the branch is kept) |

Change these in `pipeline.json` (`pullRequest`) and in `roles/pr-reviewer.md` together.

## Running it

In a Claude session started **inside a Herdr pane** (`herdr`, then `claude`), ask for it by name:

```
use the herdr pipeline: <the change you want, with any detail that matters>
```

The lead then, for each run:

1. Creates the worktree: `scripts\agents\new-worktree.ps1 -Slug <slug> -Branch <type>/<slug>` and writes your request to `<worktree>\.agent-run\task.md`.
2. Runs each stage with `scripts\agents\herdr-stage.ps1 -Role <role> -Workdir <worktree>` (planner, coder, then builder-tester and code-reviewer together, then pr-raiser, then pr-reviewer), reads the `STATUS:` line of each output file, and decides the next step: fix round, ask you, or continue.
3. Reports the PR number, the reviewer's verdict and anything left open.
4. Cleans up with `scripts\agents\remove-worktree.ps1 -Slug <slug>` (the branch is kept).

Hand-off files are in `<worktree>\.agent-run\` (git-ignored). Earlier versions of a re-run file are kept in `archive\`.

## Files

| Path | Purpose |
|------|---------|
| `docs/agents/pipeline.json` | stages, concurrency, fix rounds, git and PR rules |
| `docs/agents/roles/_common.md` | rules prepended to every agent's prompt |
| `docs/agents/roles/<role>.md` | one file per agent: what it does and what it must write |
| `scripts/agents/new-worktree.ps1` | isolated worktree from `origin/dev-env` with dependencies linked |
| `scripts/agents/herdr-stage.ps1` | runs one stage in its own pane, waits, checks the output, cleans up |
| `scripts/agents/remove-worktree.ps1` | removes a worktree without following the dependency links |

## Cost and limits

- Each agent is a full Claude session. A whole run is roughly 6 sessions plus any fix rounds; keep requests **small** (the Planner is told to propose splitting large ones).
- Herdr's Windows support is beta. If a pane misbehaves, close it with `herdr pane close <id>` and rerun that stage.
- `dev-env` has no CI, so verification is the Builder and Tester's local run. The PR description says so.
