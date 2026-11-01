# Deploying Pointfex ERP to a VPS with Dokploy

Two supported paths. **Path A (recommended)** uses Dokploy's built-in Application + Database flow with automatic Traefik SSL. **Path B** deploys the whole stack via docker-compose.

---

## 0. Prepare the repository

```bash
cd pointfex-backend
git init
git add .
git commit -m "Pointfex ERP v1 — initial release"
git remote add origin https://github.com/<you>/pointfex-erp.git
git branch -M main
git push -u origin main
```

> `.env` is gitignored — never commit real secrets. All secrets are set inside Dokploy instead.

---

## Path A — Dokploy Application + managed PostgreSQL (recommended)

### 1. Create the database
1. In your Dokploy project → **Databases → PostgreSQL**
2. Name it `pointfex`, note the generated credentials.
3. Copy the **Internal** connection string (only reachable inside the Dokploy network):
   `postgresql://pointfex:<password>@<dokploy-postgres-host>:5432/pointfex`

### 2. Create the application
1. **Applications → Dockerfile**
2. Connect your GitHub account → pick the `pointfex-erp` repo, branch `main`
3. Build configuration:
   - **Dockerfile location:** `Dockerfile`
   - **Port:** `3000`
4. **Environment variables** (Application → Environment):

   ```env
   DATABASE_URL=postgresql://pointfex:<password>@<dokploy-postgres-host>:5432/pointfex?schema=public
   JWT_SECRET=<64+ random chars — e.g. openssl rand -hex 48>
   LEDGER_SECRET_KEY=<different 64+ random chars>
   AUTO_SEED=true
   NODE_ENV=production
   ```

   > `AUTO_SEED=true` makes the first boot create the CEO/executives/6 squads/৳5.6M genesis automatically (it only seeds when the user table is empty, so restarts are safe).

5. **Deploy.** The container runs `prisma db push` then starts the API on `:3000`.

### 3. Domain + HTTPS
1. Application → **Domains** → add `pointfex.yourdomain.com`
2. Dokploy's Traefik provisions a Let's Encrypt certificate automatically (TLS 1.3, HTTP→HTTPS redirect).

### 4. First login
- Console: `https://pointfex.yourdomain.com/`
- API docs: `https://pointfex.yourdomain.com/api/docs`
- CEO: `noor@seu.edu.bd` / `PointfexCeo2026!` — **change this immediately** (see §4 below).

### 5. Backups (main.md §5.3)
Dokploy → your PostgreSQL database → **Backups** → S3-compatible endpoint:
- Endpoint: `https://<account_id>.r2.cloudflarestorage.com`
- Bucket: `pointfex-db-backups`
- Cron: `0 */6 * * *` (every 6 hours)
- Retention: `30`

---

## Path B — Compose deployment

1. Project → **Compose** → new service, point it at the same repo/branch.
2. Set the same `JWT_SECRET`, `LEDGER_SECRET_KEY`, plus `AUTO_SEED=true` and a strong `DB_PASSWORD`.
3. Deploy. `docker-compose.yml` brings up `postgres` (with healthcheck) + `api` on port 3000.
4. Add a reverse-proxy/domain pointing at port `3000` (or add Traefik labels to the `api` service).

---

## Post-deploy hardening checklist

- [ ] Change the CEO password (seeded `PointfexCeo2026!`) — update faculty credentials before the first lab
- [ ] Rotate all seeded member passwords (`Pointfex2026!`) or hand them out as one-time credentials
- [ ] Confirm `JWT_SECRET` / `LEDGER_SECRET_KEY` are 64+ random chars (never reuse the dev defaults)
- [ ] Verify `POST /api/v1/ledger/verify-chain` returns `VALID` after first boot
- [ ] Enable the 6-hourly database backups
- [ ] Optional: remove the `ports: "127.0.0.1:5432:5432"` mapping from docker-compose (Path B) — Dokploy's internal network is enough

## Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Container restarts with `P1001 can't reach database` | Wait for the DB healthcheck (Path B handles this); Path A: verify the *Internal* URL (external `localhost` URLs won't work) |
| `chainStatus: TAMPERED` on a fresh deploy | Someone changed `LEDGER_SECRET_KEY` after transactions existed — keep it constant for the deployment's lifetime |
| Login returns 401 on first try | `AUTO_SEED` didn't run — `docker exec <api-container> node dist/prisma/seed.js` once |
| Rebuild wipes nothing | Data lives in the Postgres volume/database — redeploying the app never touches it |
