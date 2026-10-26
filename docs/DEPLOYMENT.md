# Deployment Guide

---

## Prerequisites

- Docker 24+ and Docker Compose v2
- `pnpm` 9+ (for local development)
- Node.js 20 LTS (for local development)
- A MongoDB Atlas cluster **or** the MongoDB container in docker-compose
- A Meta Business Platform app (for production WhatsApp)

---

## Environment Setup

Each app needs a `.env` file. Copy the examples and fill in values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

### Minimum required values — API (`apps/api/.env`)

```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/trendy-interiors
JWT_SECRET=<at least 32 random chars>
JWT_REFRESH_SECRET=<at least 32 random chars — different from JWT_SECRET>
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-web-domain.com
SEED_MD_EMAIL=admin@yourcompany.com
SEED_MD_PASSWORD=<strong password>
```

### Minimum required values — Web (`apps/web/.env`)

```
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api/v1
NEXT_PUBLIC_WS_URL=https://your-api-domain.com
```

---

## Local Docker Compose

Start everything (API + Web + MongoDB):

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Health | http://localhost:3001/health |
| MongoDB | mongodb://localhost:27017 |

Stop and remove containers (data is preserved in the `mongo_data` volume):

```bash
docker compose down
```

Remove containers **and** data:

```bash
docker compose down -v
```

---

## Building Images Manually

```bash
# API
docker build -f apps/api/Dockerfile -t ti-api:latest .

# Web
docker build -f apps/web/Dockerfile -t ti-web:latest .
```

Both Dockerfiles use multi-stage builds so only the production artefacts end up in the final image.

---

## Production Deployment Checklist

- [ ] `NODE_ENV=production` set in all containers
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are random 32+ char strings (not the example values)
- [ ] `SEED_MD_PASSWORD` changed from `ChangeMe123!`
- [ ] `SEED_DEMO_USERS` **not** set (or set to `false`)
- [ ] `WHATSAPP_PROVIDER=meta` and all `WHATSAPP_*` vars filled
- [ ] `META_APP_SECRET` set from Meta App Dashboard → App Secret
- [ ] `WA_VERIFY_TOKEN` set to the same random value as in Meta App Dashboard
- [ ] `CORS_ORIGIN` restricted to the actual web domain (not `*`)
- [ ] MongoDB connection uses a dedicated user with minimum required permissions
- [ ] TLS/HTTPS terminated at the reverse proxy (Nginx, Caddy, or cloud LB)
- [ ] `Strict-Transport-Security` header served over HTTPS only
- [ ] Health check passes: `GET /health` returns `{ "status": "ok" }`

---

## Health Check

```bash
curl http://localhost:3001/health
# {"status":"ok","db":"connected","uptime":42.3,"timestamp":"2026-01-01T00:00:00.000Z"}
```

The Docker Compose `api` service uses this endpoint as its `healthcheck`. The `web` service only starts once the API is healthy.

---

## Database Migrations

Mongoose auto-creates collections and indexes on first start. Schema changes that require a data migration should be applied manually before deploying a new image version. Document any migrations needed in this file under a versioned section.

---

## Reverse Proxy (Nginx example)

```nginx
server {
    listen 443 ssl;
    server_name your-web-domain.com;

    location / {
        proxy_pass http://web:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://api:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## CI/CD Notes

- Run `pnpm test` (API unit + e2e tests) and `pnpm type-check` in CI before building Docker images.
- The three required-green test files are documented in `CLAUDE.md`.
- Tag Docker images with the git commit SHA for traceability.
