# Pointfex ERP — Web Console (Next.js)

Light-mode React frontend for the Pointfex ERP API. Next.js 14 (App Router) + Tailwind CSS + shadcn/ui components (installed locally in `components/ui/`) + TanStack Query v5.

## Quick start (local)

```bash
cd frontend
cp .env.example .env.local        # point NEXT_PUBLIC_API_URL at your API
npm install
npm run dev                       # http://localhost:3001
```

The API must be running (default `http://localhost:3000` — the backend docker stack).

## Structure

```
frontend/
├── app/
│   ├── page.tsx                  # login
│   ├── (console)/                # authenticated shell (sidebar + topbar + sprint chip)
│   │   ├── overview/ tasks/ squads/ people/ payroll/ finance/
│   │   ├── governance/ marketplace/ consultancy/ quality/
│   │   └── bounty/ clients/ notices/ chaos/ leaderboard/ settings/
├── components/
│   ├── ui/                       # shadcn/ui components (local, Radix + CVA + cn)
│   ├── form-dialog.tsx           # generic config-driven dialog form
│   ├── shell.tsx                 # app shell, auth/sprint/action hooks
│   └── blocks.tsx                # StatCard, EmptyState
└── lib/
    ├── api.ts                    # fetch client with refresh-token rotation
    └── utils.ts                  # cn(), taka(), dt()
```

## Environment

`NEXT_PUBLIC_API_URL` is **inlined at build time** — set it in Dokploy *before* the build runs (e.g. `https://erp.pointfex.com`). No trailing slash. The API allows cross-origin requests from any origin.

## Production (Docker)

The `Dockerfile` builds a standalone Next server on port **3001**. Deploy as a second Dokploy application:

1. Same GitHub repo as the backend, **Root directory: `frontend`**
2. Port: `3001`
3. Env: `NEXT_PUBLIC_API_URL=https://erp.pointfex.com`
4. Attach your domain (e.g. `app.pointfex.com`) — SSL is automatic.
