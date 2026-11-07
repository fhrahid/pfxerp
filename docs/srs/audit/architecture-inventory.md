# Architecture inventory

**Status:** source-grounded static architecture. All `IMPLEMENTED` statements below mean code is present and wired; live deployment and runtime behavior remain `UNVERIFIED`.

## Components and boundaries

| Boundary | Confirmed design and evidence |
|---|---|
| Browser → API | **IMPLEMENTED:** Next.js console and static console both send JSON to `/api/v1`, store access/refresh tokens in browser storage and retry after refresh (`frontend/lib/api.ts:19–102`, `public/app.js:31–74`). The Next.js console is a separate process (`frontend/package.json:5–9`); the static console is served by Nest (`src/main.ts:25–26`). |
| API routing | **IMPLEMENTED:** Nest global prefix, CORS, validation, JWT and role guards, throttling, exception filter and response interceptor (`src/main.ts:14–35`, `src/app.module.ts:40–89`). Swagger is mounted at `/api/docs` (`src/main.ts:28–35`). |
| Auth/authorization | **IMPLEMENTED:** bcrypt password checking, short access JWT plus rotating refresh JWT hash, password reset, active-user lookup and live memberships (`src/modules/auth/auth.service.ts:26–100`, `:105–291`; `src/modules/auth/jwt.strategy.ts:20–46`). `@Roles` checks fixed system role strings; CEO bypasses role checks. Ownership is checked in service methods (`src/common/guards/roles.guard.ts:15–33`, `src/modules/tasks/tasks.service.ts:413–480`). |
| Persistence | **IMPLEMENTED:** Prisma client on PostgreSQL, global provider, startup wallet backfill (`prisma/schema.prisma:1–10`, `src/prisma/prisma.module.ts:4–9`, `src/prisma/prisma.service.ts:4–22`). The backend image uses `prisma db push` before boot (`Dockerfile:51–55`). |
| Financial core | **IMPLEMENTED:** ledger posts balanced debit/credit entries, serializes its global hash chain with a PostgreSQL advisory lock, locks accounts, checks frozen/balance state, records HMAC hashes and idempotency keys (`src/modules/ledger/ledger.service.ts:46–183`, `:307–361`; `prisma/schema.prisma:360–410`). |
| Asynchronous work | **IMPLEMENTED:** Nest cron jobs update task performance and squad metrics, and a process-local timer sweeps chaos penalties (`src/modules/tasks/tasks.service.ts:209–224`, `src/modules/dashboard/dashboard.service.ts:75–183`, `src/modules/chaos/chaos.service.ts:25–32`, `:160–173`). No Redis/BullMQ worker is registered in `src/app.module.ts:40–77` or declared in `package.json:22–54`. |
| Events | **IMPLEMENTED:** Socket.IO gateway at `/events` with `studio`, `squad:<id>` and `user:<id>` rooms (`src/events/events.gateway.ts:18–56`). **PARTIAL:** connection and `subscribe` handling do not authenticate room membership; the source comment explicitly defers that enforcement (`src/events/events.gateway.ts:11–17`, `:25–39`). |

## Data model

`prisma/schema.prisma` defines **43 models and 30 enums** (counted from top-level `model` and `enum` declarations on 2026-11-07). The SQL history consists of an initial migration and an untracked alignment migration (`prisma/migrations/20261102000000_initial/migration.sql:1`, `prisma/migrations/20261107000000_align_schema/migration.sql:1–120`). Read-only inspection of the owner's selected local PostgreSQL baseline confirmed 43 application tables and both migrations finished; see `docs/srs/audit/database-baseline.md`. A separate deployment remains unverified.

| Cluster | Models and main relationships |
|---|---|
| Identity/organization | `User`, `Role`, `Invitation`, `PasswordReset`, `Squad`, `SquadMembership`, `SquadRepository`. Membership joins users and squads; repository records belong to squads (`prisma/schema.prisma:237–359`, `:1010–1053`). `User.role` and `Invitation.role` are strings, while `UserRole` remains a fixed enum for code and audit records (`prisma/schema.prisma:14–21`, `:243`, `:997`, `:1013`). |
| Finance | `Account`, `LedgerTransaction`, `LedgerEntry`, `PoolFundingRequest`, `Loan`, `EquityStake`, `SprintPayout`, `SprintPayoutItem`, `FineProposal`. Accounts may belong to users or squads; entries belong to transactions and accounts; loans/payouts/fines reference squads or users (`prisma/schema.prisma:360–410`, `:496–511`, `:570–607`, `:955–984`, `:1062–1083`). |
| Work/people | `Task`, `TaskAssignee`, `TaskAuditEvent`, `PayrollProposal`, `PayrollLineItem`, `Notice`, `DeveloperPerformanceSnapshot`, `PmPerformanceSnapshot`, `SquadHealthSnapshot` (`prisma/schema.prisma:412–495`, `:512–569`, `:898–954`). Tasks have a primary assignee and a separate multi-assignee join (`prisma/schema.prisma:419`, `:458`, `:482–495`). |
| CTO/governance | `BugBountyTarget`, `BugReport`, `CodeAuditCitation`, `ConsultancyBooking`, `MarketplaceListing`, `MarketplacePurchase`, `CtoProviderCertification`, `BoardDecision`, `DecisionVote`, `ChaosEvent`, `ExecutiveAuditLog` (`prisma/schema.prisma:608–810`, `:993–1009`). |
| Client/products | `Client` → `ClientContract` → `ClientMilestone`; `Product` belongs to a squad and optionally a contract; `ProductTelemetryHourly` belongs to a product (`prisma/schema.prisma:811–897`). |
| Configuration/operations | `SystemSetting`, `ProductionResetLog` (`prisma/schema.prisma:985–992`, `:1054–1061`). |

## External systems and configuration

- **IMPLEMENTED:** PostgreSQL is the only Compose data service (`docker-compose.yml:1–21`); API DB connection comes from `DATABASE_URL` (`docker-compose.yml:22–45`, `prisma/schema.prisma:1–5`).
- **IMPLEMENTED:** `SquadsService.gh` calls GitHub REST at `api.github.com`, optionally using a stored repository token (`src/modules/squads/squads.service.ts:183–229`; `prisma/schema.prisma:325–340`). No webhook or GitHub App wiring was found in the runtime module list (`src/app.module.ts:40–77`).
- **IMPLEMENTED with fallback:** `MailService` uses Resend when configured; otherwise it records simulated delivery (`src/modules/mail/mail.service.ts:33–70`, `:74–318`).
- **IMPLEMENTED:** telemetry ingestion accepts a product API key and writes hourly aggregates through Prisma (`src/modules/telemetry/telemetry.controller.ts:41–49`, `src/modules/telemetry/telemetry.service.ts:25–115`). **PLANNED:** the Redis buffer and Timescale rollup pictured in `plan/other.md:57–87` are absent from the current runtime/dependencies (`package.json:22–54`).
- **IMPLEMENTED:** environment reads and examples include JWT/ledger secrets, database, email domain, seed credentials, mail, port/prefix and frontend URL (`src/env.ts:8–42`, `src/main.ts:15`, `:37–57`, `.env.example:4–38`, `frontend/.env.example:1–5`). `ALLOW_CEO_DATA_RESET` gates a one-time reset endpoint (`src/modules/settings/settings.service.ts:57–90`).

## End-to-end source workflows

| Workflow | Confirmed path |
|---|---|
| Invitation → account | Executive creates invitation → mail link or simulated delivery → public verification/acceptance → user, wallet and optional membership → issued tokens (`src/modules/invitations/invitations.controller.ts:15–59`, `src/modules/invitations/invitations.service.ts:28–133`, `:285–450`, `src/modules/auth/auth.service.ts:26–49`). |
| Task delivery | PM/executive creates work → assignee starts and supplies Git proof → PM verifies/rejects → CTO verifies/rejects → PM/CTO closes; audit events and metrics update (`src/modules/tasks/tasks.service.ts:11–69`, `:226–296`, `:487–718`). |
| Sprint reward | CFO proposes ranking → CEO approves → CFO executes per-squad ledger postings, tax, optional dividend and PM bonus (`src/modules/sprint-payouts/sprint-payouts.service.ts:24–76`, `:85–199`). |
| Loan | PM applies below treasury threshold → board decision/CEO authorization → CFO posts disbursement → PM repays principal and interest (`src/modules/loans/loans.service.ts:24–61`, `:89–195`, `src/modules/governance/governance.service.ts:26–120`). |
| Client revenue | Client/contract/milestone → escrow funding → squad assignment → CTO audit → client acceptance → escrow distribution (`src/modules/clients/clients.service.ts:24–240`). |
| Payroll | PM submits proposal → CPO/CEO approval disburses from squad treasury; CPO may reject; fine proposals have CFO approval (`src/modules/payroll/payroll.service.ts:31–124`, `:125–396`). |

## Significant architectural limits

- **PARTIAL:** `README.md:81` calls the sprint payout waterfall atomic; source loops and posts one transaction per squad and updates payout status afterward (`src/modules/sprint-payouts/sprint-payouts.service.ts:108–190`). The entire payout is not wrapped in one database transaction. Record the actual per-squad behavior in the SRS.
- **PARTIAL:** notice encryption exists in clients and the server stores ciphertext. Both clients put ciphertext plus authentication tag in `data` and omit a separate `tag` (`frontend/lib/notice-crypto.ts:74–89`, `public/app.js:2547–2562`). Dispatch validates `alg`, key type, IV and `data` length but does not require a separate `tag` (`src/modules/notices/notices.controller.ts:55–70`, `:118–124`). Live dispatch and decryption were not tested; the selected versioned separate-tag target remains PLANNED.
- **UNVERIFIED:** schema in any separate deployment, mail delivery, GitHub access and runtime route behavior were not checked. The working tree has an untracked alignment migration (`prisma/migrations/20261107000000_align_schema/migration.sql:1–120`), although the local database records it as finished (`docs/srs/audit/database-baseline.md`); Docker startup uses schema push (`Dockerfile:51–55`).
