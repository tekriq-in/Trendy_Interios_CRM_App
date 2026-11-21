# CI/CD

## Flow

```
feature branch ──PR into dev──▶ ci.yml        type-check, API tests, builds, Docker builds
                                   │ must be green (set as a required check)
merge PR into dev ─────────────▶ deploy.yml   1. CI gate (same checks again on the merge commit)
                                              2. API  → Render  (deploy hook, waits for /health/ready)
                                              3. Web  → Vercel  (CLI, after the API is healthy)
```

Render and Vercel git auto-deploy are **off**, so a deploy only happens through `deploy.yml`.
If CI fails on the merge commit, nothing is deployed.

## One-time setup

### 1. Vercel project
1. Import the GitHub repo in Vercel. **Root Directory = `apps/web`**, keep "Include source files outside of the Root Directory" on. Framework: Next.js, Node 20.x.
2. Settings → Environment Variables (Production):
   - `NEXT_PUBLIC_API_URL` = `https://<render-service>.onrender.com/api/v1`
   - `NEXT_PUBLIC_WS_URL`  = `https://<render-service>.onrender.com`
3. Create a token (Account Settings → Tokens). Get the IDs from `.vercel/project.json` after running `vercel link` once, or Project Settings → General.

### 2. Render service
1. New → Blueprint → select this repo (`render.yaml`), branch `dev`.
2. Fill the `sync: false` secrets (`MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SEED_MD_*`, `CORS_ORIGIN`, ...). `CORS_ORIGIN` must be the exact Vercel URL.
   Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
3. Settings → Deploy Hook → copy the URL.

### 3. GitHub
Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `RENDER_DEPLOY_HOOK_URL` | Render deploy hook URL |
| Secret | `VERCEL_TOKEN` | Vercel token |
| Secret | `VERCEL_ORG_ID` | from `.vercel/project.json` (`orgId`) |
| Secret | `VERCEL_PROJECT_ID` | from `.vercel/project.json` (`projectId`) |
| Variable | `API_HEALTH_URL` | `https://<render-service>.onrender.com/health/ready` |

Settings → Environments → create `production` (optional: add required reviewers for a manual approval before each deploy).

Settings → Branches → add a rule for `dev`: require a pull request and require the status check **Type-check, test & build** (and **Docker images build**) to pass before merging.

## Re-deploy / rollback
- Re-run: Actions → Deploy → **Run workflow** (deploys the selected branch).
- Rollback: revert the bad merge on `dev` (a new PR); the merge deploys the previous code. Render also keeps previous deploys (Dashboard → Rollback) for an instant API rollback, and Vercel keeps previous deployments (Promote to Production).
