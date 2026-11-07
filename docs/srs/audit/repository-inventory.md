# Repository inventory

**Audit basis:** working tree on 2026-11-07. This is a source inspection, not a claim that a deployment or database is running. The project contains executable application code as well as specifications; it is not a specifications-only repository (`src/main.ts:11–59`, `frontend/app/page.tsx:13`, `public/app.js:4`). The complete 208-file inclusion list and exclusions are in [coverage-checklist.md](coverage-checklist.md).

## Layout and entry points

| Area | Source evidence | Confirmed purpose |
|---|---|---|
| API bootstrap | `src/main.ts:11–59`, `src/app.module.ts:40–90` | NestJS HTTP API; default `/api/v1` prefix, global validation, guards, response/error handling, static assets, Swagger, optional first-boot seed. |
| Business backend | `src/app.module.ts:16–38`, `:54–77`; `src/modules/*/*.module.ts` | 24 registered business modules, with controllers and services. |
| Database | `prisma/schema.prisma:1–10`, `:237–1083`; `src/prisma/prisma.service.ts:4–22` | PostgreSQL via Prisma; 43 schema models and 30 enums; global Prisma provider. |
| Schema history | `prisma/migrations/20261102000000_initial/migration.sql:1`; `prisma/migrations/20261107000000_align_schema/migration.sql:1–120`; `docs/srs/audit/database-baseline.md` | Initial SQL migration plus a currently untracked alignment migration adding four tables and enum values. Both are recorded as finished in the chosen local database. |
| Next.js client | `frontend/package.json:5–40`, `frontend/app/page.tsx:13–78`, `frontend/components/shell.tsx:48–67`, `frontend/lib/api.ts:1–139` | Separate App Router console with login, role-filtered navigation and API client. |
| Static client | `src/main.ts:25–26`, `public/index.html:13`, `public/app.js:4–7`, `:488–505` | Browser console served by the API process from `public/`. |
| Containers | `Dockerfile:4–55`, `frontend/Dockerfile:4–34`, `docker-compose.yml:1–52` | API and frontend images; Compose provisions PostgreSQL and API only. |
| Support scripts | `scripts/full-verify.mjs:1–7`, `scripts/frontend-smoke.cjs:1–4`, `scripts/playwright-full-suite.mjs:1–9` | Verification, smoke, browser and maintenance utilities. They are not runtime modules and were not executed for this audit. |

## Declared stack and observed architecture

- **IMPLEMENTED in source:** TypeScript, NestJS 11, Passport JWT, Socket.IO, Nest scheduling and throttling, Prisma 5, PostgreSQL 16 Compose image, bcryptjs and Resend SDK (`package.json:22–54`, `docker-compose.yml:2–3`, `src/app.module.ts:40–83`).
- **IMPLEMENTED in source:** Next.js 14, React 18, Tailwind, Radix UI components, TanStack Query and browser Web Crypto (`frontend/package.json:11–39`, `frontend/lib/notice-crypto.ts:22–37`).
- **IMPLEMENTED in source:** HTTP controllers call service classes, which use Prisma and the ledger/events services; `src/app.module.ts:54–83` registers the controller modules and global guards. Finance and operational state share a PostgreSQL database (`prisma/schema.prisma:237–1083`).
- **IMPLEMENTED local schema evidence:** read-only catalog inspection of PostgreSQL from `.env.example:10–13` found 43 application tables and 30 enums, with model columns and enum values matching the current generated Prisma model. Both migrations are recorded as finished; see `docs/srs/audit/database-baseline.md`. **UNVERIFIED elsewhere:** a separate deployment was not inspected. The API image starts with `prisma db push`, while `package.json:13` defines a separate `migrate deploy` command (`Dockerfile:51–55`, `package.json:7–13`).

## Backend module index

The following modules are registered by `src/app.module.ts:54–77`. Their route declarations are enumerated in [evidence-map.md](evidence-map.md); each has a corresponding service except Notices, whose controller uses Prisma directly (`src/modules/notices/notices.module.ts:6–10`).

| Module | Owning source | Main surface |
|---|---|---|
| Auth, Roles, Invitations, Users | `src/modules/auth/auth.controller.ts:53`; `src/modules/roles/roles.controller.ts:11`; `src/modules/invitations/invitations.controller.ts:11`; `src/modules/users/users.controller.ts:63` | Sign-in/session recovery, role catalog, onboarding, user management. |
| Squads, Tasks, Payroll, Notices | `src/modules/squads/squads.controller.ts:83`; `src/modules/tasks/tasks.controller.ts:125`; `src/modules/payroll/payroll.controller.ts:84`; `src/modules/notices/notices.controller.ts:38` | Roster/repositories, task gates, lab pay/fines, encrypted notices. |
| Ledger, Loans, Equity, SprintPayouts | `src/modules/ledger/ledger.controller.ts:65`; `src/modules/loans/loans.controller.ts:19`; `src/modules/equity/equity.controller.ts:23`; `src/modules/sprint-payouts/sprint-payouts.controller.ts:32` | Accounts/postings, debt, investments, sprint rewards. |
| Governance, Chaos, Audit | `src/modules/governance/governance.controller.ts:46`; `src/modules/chaos/chaos.controller.ts:48`; `src/modules/audit/audit.controller.ts:35`; `src/modules/audit/executive-audit.controller.ts:9` | Board decisions, simulations, citations and log listing. |
| Bounty, Certifications, Marketplace, Consultancy | `src/modules/bounty/bounty.controller.ts:73`; `src/modules/certifications/certifications.controller.ts:39`; `src/modules/marketplace/marketplace.controller.ts:34`; `src/modules/consultancy/consultancy.controller.ts:32` | Quality and CTO marketplace operations. |
| Clients, Dashboard, Telemetry, Settings | `src/modules/clients/clients.controller.ts:66`; `src/modules/dashboard/dashboard.controller.ts:10`; `src/modules/telemetry/telemetry.controller.ts:36`; `src/modules/settings/settings.controller.ts:37` | Client milestones, metrics/views, product events, settings/reset. |
| Mail | `src/modules/mail/mail.module.ts:4–9`, `src/modules/mail/mail.service.ts:33–50` | Invitation and password reset delivery; no HTTP controller. |

## Existing documentation and status

- `README.md:69–108` describes v1 functionality, while `README.md:156–162` marks Redis, BullMQ, TimescaleDB, CASL and Next.js as deferred. The Next.js client now exists (`frontend/package.json:25–27`, `frontend/app/page.tsx:13`), so that last statement is stale.
- `plan/main.md:38–58`, `plan/security.md:137–239`, `plan/cto.md:795–812`, and `plan/other.md:57–130` describe target architecture and workflows. These are **PLANNED** claims until matched to current code. The current dependency manifests do not declare Redis, BullMQ, CASL or TimescaleDB (`package.json:22–54`, `frontend/package.json:11–39`), and Compose has no such services (`docker-compose.yml:1–52`).
- Role plans are `plan/chro.md`, `plan/cto.md`, `plan/cfo.md`, `plan/pm.md`, `plan/dev.md`; `plan/ceo.md`, `plan/security.md`, `plan/other.md`, and `plan/main.md` cover shared/CEO concerns. `decesion.md` records architectural decisions, but its claims are treated as historical documentation, not implementation proof (`decesion.md:1–7`).
- `DEPLOY.md:23–115` and `frontend/README.md:1–47` describe deployment and client setup. Their actual behavior depends on the current Dockerfiles, source and deployment environment.

### Concrete documentation differences

| Documentation claim | Source-grounded finding |
|---|---|
| `plan/main.md:42`, `:49` specifies NestJS 10 and Zod/nestjs-zod. | **IMPLEMENTED:** the manifests declare NestJS 11 and `class-validator`/`class-transformer` (`package.json:23–38`); request validation is Nest's `ValidationPipe` (`src/main.ts:17–23`). |
| `plan/cto.md:824–853` lists `/cto/tasks/...`, `/cto/bounty/...`, consultancy slot and report-generation endpoints. | **PARTIAL:** current task endpoints use `/tasks/...` (`src/modules/tasks/tasks.controller.ts:125–209`), bounty uses `/bounty/...` (`src/modules/bounty/bounty.controller.ts:73–110`), bookings use `/cto/consultancy/bookings` (`src/modules/consultancy/consultancy.controller.ts:32–61`); no slot or report controller is registered in `src/app.module.ts:54–77`. |
| `plan/security.md:45–55`, `:137–239` specifies Redis session state and CASL abilities. | **PLANNED:** current auth uses a stored refresh-token hash (`src/modules/auth/auth.service.ts:26–49`, `:105–151`) and fixed role guard plus service checks (`src/common/guards/roles.guard.ts:15–33`, `src/modules/tasks/tasks.service.ts:413–480`). |
| `plan/other.md:57–87`, `:114–130` specifies Redis/Timescale telemetry and BullMQ monitors. | **PARTIAL:** product telemetry and scheduled metrics exist in PostgreSQL/Nest scheduling (`src/modules/telemetry/telemetry.service.ts:25–115`, `src/modules/tasks/tasks.service.ts:209–224`, `src/modules/dashboard/dashboard.service.ts:75–183`). The named infrastructure is not declared in the runtime manifest or Compose (`package.json:22–54`, `docker-compose.yml:1–52`). |
