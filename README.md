# Pointfex ERP — v1 (First Working Version)

> **Pointfex Venture Studio** — *"From an idea to a greater impact"*
> CSE474 — Software Development and Project Management, Southeast University

Implementation of the Pointfex ERP specification suite (`main.md`, `ceo.md`, `cfo.md`, `cto.md`, `chro.md`, `pm.md`, `dev.md`, `security.md`, `other.md`) as a runnable NestJS backend.

---

## Quick Start

### Option A — Docker (recommended)

```bash
cp .env.example .env          # edit secrets for production
docker compose up -d --build  # postgres + api on :3000 (waits for db healthcheck)
docker compose exec api node dist/prisma/seed.js   # genesis seeding
```

### Option B — Local Node 20+ with a running PostgreSQL

```bash
cp .env.example .env          # point DATABASE_URL at your database
npm install
npm run db:setup              # apply migrations + seed
npm run dev                   # ts-node dev server on :3000
```

- **API base:** `http://localhost:3000/api/v1`
- **Web console:** `http://localhost:3000/` — role-aware test console (zero-build SPA served by the API)
- **Swagger docs:** `http://localhost:3000/api/docs`
- **WebSocket:** `ws://localhost:3000/events` (emit `subscribe` with `{ rooms: ["squad:<id>", "user:<id>"] }`)

### Web Console (testing frontend)

A dependency-free single-page console in `public/` (served by the API at `/` — no separate build or container). It covers every v1 flow with role-aware UI:

- **Overview** — wallet, DPI, squad health, notice inbox
- **Tasks** — 7-column Kanban with the full state machine (create → start → flag-complete with git proof → PM verify/reject → CTO verify/reject → close) and audit trails
- **Squads** — treasuries, valuations, health, members; CPO member transfers
- **Payroll** — PM proposal builder (tier caps, live total vs ৳10,000 budget), CHRO approve/reject queue, slacker fines
- **Finance** — sprint payout ranker (submit → CEO approve → CFO execute), loans (apply/disburse/repay), equity investment, ledger feed
- **Governance** — propose, 2-of-3 voting, CEO sign-off/veto with loan unlocks
- **Bug Bounty** — fund targets, submit cross-squad reports, CTO triage & payouts
- **CTO Tools** — citations, certification queue, marketplace publish/purchase, consultancy booking/settlement
- **Clients** — contracts, milestones, escrow funding, CTO gate, client acceptance waterfall
- **Notices** — zero-knowledge inbox with client-side "decrypt" + signed acknowledgments, CPO/CEO dispatch
- **Chaos** — CEO trigger console (outage penalties, sick-leave lockouts), squad resolution
- **Leaderboard** — squad valuations and student simulation scores
- **Settings** — live SystemSettings editing (CEO)

Demo cryptography: notices are base64-encoded client-side as a stand-in for AES-256-GCM/Ed25519 so the full dispatch → inbox → decrypt → acknowledge loop is testable.

### Seeded Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| CEO (Faculty) | `noor@seu.edu.bd` | `PointfexCeo2026!` |
| CFO | `cfo@pointfex.dev` | `Pointfex2026!` |
| CTO | `cto@pointfex.dev` | `Pointfex2026!` |
| CPO (CHRO) | `cpo@pointfex.dev` | `Pointfex2026!` |
| PMs | `pm1..pm6@pointfex.dev` | `Pointfex2026!` |
| Developers | `dev{squad}_{1..4}@pointfex.dev` | `Pointfex2026!` |

Genesis state: 33 students + 1 faculty, 6 squads × ৳100,000 treasury, ৳5,000,000 system reserve, escrow account, CTO lifetime certifications, and all `SystemSettings` constants from `main.md §8`.

---

## What v1 Implements

### Core Engine
- **Double-entry ledger** with HMAC-SHA256 hash chaining, deterministic `FOR UPDATE` row locking, frozen-account blocking, balance validation, and idempotency-key replay (`security.md §5`)
- **CEO one-click chain verification** — `POST /ledger/verify-chain` re-computes every hash from genesis and reports tampered sequence numbers (`BR-CEO-10`)
- **Auth** — bcrypt(12), 15m access JWT, 7d refresh JWT with rotation + reuse detection (CRITICAL audit + family revocation)
- **RBAC** — `@Roles()` guard pipeline; CEO bypasses all checks; ownership/cross-squad (ABAC) rules enforced in services
- **Settings** — dynamic `SystemSettings` key-value store with in-memory cache; CEO-only writes
- **WebSocket events** — `task:status_changed`, `notice:incoming`, `payroll:executed`, `chaos:triggered`, `bounty:verified`, `balance:updated`, `governance:vote_cast` (see `other.md §6`)

### Finance (cfo.md)
- **Sprint payout engine** — strict 1..N ranking validation → CEO approval gate → atomic waterfall (5% CFO tax, net to squad, 10% PM leadership bonus for top-3, automated 10% equity dividend where the CFO holds a stake)
- **Emergency loans** — threshold guard (< ৳15,000), 15% interest, 2-of-3 board decision + CEO sign-off required, CFO disbursement, PM repayment (principal → reserve, interest → CFO), lazy default detection
- **Venture equity** — CFO stakes (max 2 squads/sprint), automated dividends on squad revenue

### Tasks (pm.md / dev.md)
- 7-column Kanban state machine: `BACKLOG → TODO → IN_PROGRESS → FLAGGED_COMPLETE → PM_VERIFIED → CTO_VERIFIED → CLOSED`
- Git-proof gate (PR URL / commit hash required), premature-flag penalties (−15..−50 DPI), CTO rejection → automatic citation fine + PMHI demerit, audit trail on every transition, conflict-of-interest guards

### CTO (cto.md)
- Code audit citations (fine split: 1000 CTO wallet / 1000 reserve) + CEO reverse penalty (4000)
- Provider certification gate (score ≥ 80, 90-day validity, 7-day rejection cooldown) guarding marketplace + consultancy
- **Bug bounty arena** — escrowed pools, cross-squad rule (2-sprint cooldown), 5 claims/sprint cap, 25% treasury drain cap, severity-based payouts (5000/3000/1000/500)
- Marketplace (single purchase per squad per asset, 100% to author wallet) and paid consultancy (escrow → 50/50 split, ≥50-word notes + PR link proof, weekly cap 2, >2h cancellation refund)

### CHRO (chro.md)
- Weekly lab payroll (tier caps 3500/2000/1000/0, ৳10,000 budget) with batch disbursement
- Slacker fines (500 CPO / 1500 reserve, wallet → treasury shortfall fallback)
- Zero-knowledge E2EE notices (server stores ciphertext + signatures only) with signed acknowledgments
- Squad roster: elastic headcount, fractional allocations (Σ ≤ 1.0), transfers/firing with ৳5,000 swap fee

### CEO (ceo.md)
- Chaos engine: `SCOPE_CREEP`, `LEAD_DEV_SICK_LEAVE` (30-min lockout enforced in the task service), `SERVER_OUTAGE` (timed auto-penalty sweeper), `CUSTOM`
- Account freeze/unfreeze, discretionary bonuses, 360 dashboard (macro liquidity, squad health/DPI/PMHI, executive wallets, pending decisions, live transaction feed)
- Governance: 2-of-3 board voting (no self-vote, one vote each), CEO unilateral approve/veto with loan unlock side effects

### Real Clients (other.md)
- Client CRM → contracts (25/65/10 revenue splits, must sum to 1.0) → milestone escrow → squad assignment → CTO audit gate → client acceptance → automated escrow waterfall (+ equity dividend)
- **Simulation Stock Exchange** — dynamic valuation (`treasury + 1.5 × recognized revenue − active debt`), runway-based health (`BULLISH/STABLE/BANKRUPT_RISK`), final score = 50% normalized squad valuation + 50% normalized wallet (`GET /simulation-scores`)

---

## Verification

Three end-to-end suites ship in `scripts/` (run against a freshly seeded DB):

```powershell
# 1. full business-rule verification — every BR in all 9 spec files, all 6 roles
# Destructive: use only with a disposable local verification database.
docker compose exec api npx prisma migrate reset --force --skip-seed
docker compose exec api node dist/prisma/seed.js
node scripts/full-verify.mjs          # 90/90 checks incl. exact ledger math, chain tamper detection, conservation

# 2. realistic sprint narrative through every module
node scripts/company-flow.mjs

# 3. frontend console smoke (headless DOM)
node scripts/frontend-smoke.cjs
```

Last run: **90/90 rules passed** (all calculations verified to the taka against the database, money supply conserved at ৳5,600,000, HMAC chain VALID). See `DEPLOY.md` for the Dokploy VPS guide.

---

## Project Layout

```
pointfex-backend/
├── Dockerfile / docker-compose.yml / .env.example
├── prisma/            # schema.prisma (master schema + v1 additions) + seed.ts (genesis)
├── scripts/           # smoke-test.ps1, loan-test.ps1
└── src/
    ├── main.ts / app.module.ts / env.ts
    ├── prisma/        # PrismaService
    ├── events/        # Socket.io gateway
    ├── common/        # guards, filters, interceptors, decorators, error codes
    └── modules/
        ├── auth/ users/ squads/ settings/ ledger/
        ├── tasks/ payroll/ notices/ loans/ equity/ sprint-payouts/
        ├── governance/ chaos/ bounty/ audit/ certifications/
        ├── marketplace/ consultancy/ clients/ dashboard/
```

## v1 Additions to the Master Schema

Documented inline in `prisma/schema.prisma`: `SprintPayout`/`SprintPayoutItem`, `BoardDecision.referenceId`, `ChaosEvent.penaltyDueAt/penaltyAppliedAt`, `BugReport.sprintNumber`, `MarketplaceListing.isDelisted`, unique `(listingId, buyerSquadId)` purchase index, certification portfolio fields, and the shared `ESCROW` account.

## Deferred to v2 (per spec roadmap)

- Redis + BullMQ workers (reports, no-show scanner, chaos penalties — currently in-process/DB-backed)
- TimescaleDB telemetry ingestion + product SDK (`other.md §3`)
- PDF/Markdown executive report generator
- CASL ability factory (currently service-level ownership checks)
- Next.js executive + squad frontends
- `bcryptjs` stands in for `bcrypt` (pure-JS, no native build); swap back for production if preferred
