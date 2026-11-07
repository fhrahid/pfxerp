# Feature inventory

The statuses follow `docs/srs/WORKING_RULES.md`. `IMPLEMENTED` means the cited behavior is present in source and connected to a registered module, not that it was exercised in a running environment. Shared capabilities appear once; the role columns name perspectives that use them. The **current** code combines people operations under `CPO` (`src/common/types.ts:10–11`, `prisma/schema.prisma:14–21`); the **target** separates CHRO and CPO (`docs/srs/DECISIONS.md`).

## Shared capabilities

| Capability | Status | Perspectives | Evidence and boundary |
|---|---|---|---|
| Email/password login, JWT access and refresh, logout, password change/reset | IMPLEMENTED | All | `src/modules/auth/auth.controller.ts:61–104`; `src/modules/auth/auth.service.ts:26–291`; `src/modules/auth/jwt.strategy.ts:20–46`. |
| Configurable allowed email domain | IMPLEMENTED | All | `src/common/types.ts:26–38`; `src/modules/auth/auth.service.ts:51–56`. Default is `seu.edu.bd`, but `ALLOWED_EMAIL_DOMAIN` can contain a comma-separated list. |
| Fixed system role guards and service ownership checks | IMPLEMENTED | All | `src/app.module.ts:78–83`; `src/common/guards/roles.guard.ts:15–33`; `src/modules/tasks/tasks.service.ts:413–480`. |
| Dynamic role catalog and CEO creation | PARTIAL | CHRO, Developer | `src/modules/roles/roles.service.ts:8–102`; `prisma/schema.prisma:1042–1053` store custom roles, but role guards and executive helpers use fixed system role names (`src/common/guards/roles.guard.ts:29–33`, `src/common/types.ts:10–24`). Permissions for custom roles are not defined by a policy engine. |
| Invitations and optional squad assignment | IMPLEMENTED | CHRO, CTO, CFO, Developer | `src/modules/invitations/invitations.controller.ts:15–59`; `src/modules/invitations/invitations.service.ts:28–133`, `:285–450`. Executive invitation permissions are narrowed in service. |
| User/squad roster and fractional membership | IMPLEMENTED | CHRO, PM, Developer | `src/modules/users/users.controller.ts:63–136`; `src/modules/squads/squads.controller.ts:83–169`; `src/modules/squads/squads.service.ts:357–524`; `prisma/schema.prisma:342–359`. |
| Task state and multi-assignee records | IMPLEMENTED | PM, Developer, CTO | `src/modules/tasks/tasks.controller.ts:125–209`; `src/modules/tasks/tasks.service.ts:11–69`, `:226–718`; `prisma/schema.prisma:412–495`. |
| Per-user notice keys, encrypted notice storage and signed acknowledgments | PARTIAL | CHRO, Developer | Server endpoints exist (`src/modules/notices/notices.controller.ts:74–201`); both browser clients produce an envelope without the server-required `tag` (`frontend/lib/notice-crypto.ts:74–89`, `public/app.js:2547–2562`, `src/modules/notices/notices.controller.ts:55–70`). |
| Account balances and double-entry ledger postings | IMPLEMENTED | CFO, CHRO, CTO, PM, Developer | `src/modules/ledger/ledger.service.ts:46–183`, `:200–226`; `prisma/schema.prisma:360–410`. Read/write scope depends on individual endpoints and services (`src/modules/ledger/ledger.controller.ts:65–308`). |
| Socket.IO event emission and subscriptions | PARTIAL | All | Namespace, rooms and emits exist (`src/events/events.gateway.ts:18–56`), but room subscription has no JWT/ownership check (`:25–39`). |
| Next.js and static web consoles | IMPLEMENTED | All | `frontend/app/page.tsx:13–78`; `frontend/components/shell.tsx:48–67`; `public/app.js:361–408`; `src/main.ts:25–26`. Each page/action still requires separate runtime verification. |

## CHRO / CPO

| Capability | Status | Evidence and boundary |
|---|---|---|
| Payroll proposal, approval/rejection and disbursement | IMPLEMENTED | `src/modules/payroll/payroll.controller.ts:89–109`; `src/modules/payroll/payroll.service.ts:125–328`; `prisma/schema.prisma:512–549`. |
| Slacker fine and fine proposal with CFO approval | IMPLEMENTED | `src/modules/payroll/payroll.controller.ts:114–134`; `src/modules/payroll/payroll.service.ts:31–124`, `:329–396`; `prisma/schema.prisma:1062–1083`. |
| Squad creation, transfer and member removal | IMPLEMENTED | `src/modules/squads/squads.controller.ts:98–169`; `src/modules/squads/squads.service.ts:83–181`, `:372–524`. |
| Encrypted notice dispatch as described in the plan | PARTIAL | `plan/chro.md:55–64` specifies the flow; controller and clients disagree on envelope shape as noted above. |

## CTO

| Capability | Status | Evidence and boundary |
|---|---|---|
| CTO task verification/rejection and citation fines | IMPLEMENTED | `src/modules/tasks/tasks.controller.ts:195–203`; `src/modules/tasks/tasks.service.ts:597–685`; `src/modules/audit/audit.service.ts:20–91`. |
| Provider certification application and review | IMPLEMENTED | `src/modules/certifications/certifications.controller.ts:44–76`; `src/modules/certifications/certifications.service.ts:19–165`. |
| Bug bounty target/report/triage | IMPLEMENTED | `src/modules/bounty/bounty.controller.ts:78–110`; `src/modules/bounty/bounty.service.ts:25–254`. |
| Marketplace listing, purchase, verification and delisting | IMPLEMENTED | `src/modules/marketplace/marketplace.controller.ts:39–74`; `src/modules/marketplace/marketplace.service.ts:24–145`. |
| Paid consultancy booking/completion/cancellation | IMPLEMENTED | `src/modules/consultancy/consultancy.controller.ts:37–61`; `src/modules/consultancy/consultancy.service.ts:26–190`. |
| Automated BullMQ executive reports and Redis enforcement | PLANNED | Described in `plan/cto.md:795–812`, `:2259–2343`; no BullMQ/Redis dependency in `package.json:22–54` or worker registration in `src/app.module.ts:40–77`. |
| Consultancy office-hour slots and `/cto/reports/generate` endpoint | PLANNED | Listed in `plan/cto.md:824–853`; current consultancy controller exposes bookings only (`src/modules/consultancy/consultancy.controller.ts:32–61`) and the registered modules contain no report controller (`src/app.module.ts:54–77`). |

## CFO

| Capability | Status | Evidence and boundary |
|---|---|---|
| Sprint payout proposal, CEO approval and per-squad execution | IMPLEMENTED | `src/modules/sprint-payouts/sprint-payouts.controller.ts:37–57`; `src/modules/sprint-payouts/sprint-payouts.service.ts:24–199`. |
| All-or-nothing payout across all ranked squads | UNVERIFIED | `README.md:81` says “atomic waterfall”; source posts in a loop and marks the batch executed after the loop (`src/modules/sprint-payouts/sprint-payouts.service.ts:108–190`). There is no source basis to state all-or-nothing semantics. |
| Loan application, approval gate, disbursement and repayment | IMPLEMENTED | `src/modules/loans/loans.controller.ts:23–43`; `src/modules/loans/loans.service.ts:24–195`; `src/modules/governance/governance.service.ts:96–120`. |
| Equity investment and dividend calculation | IMPLEMENTED | `src/modules/equity/equity.controller.ts:28–36`; `src/modules/equity/equity.service.ts:19–128`. |
| Pool funding request/approval, allocations, reserve sweep | IMPLEMENTED | `src/modules/ledger/ledger.controller.ts:92–221`; `src/modules/ledger/ledger.service.ts:200–277`; `prisma/schema.prisma:496–511`. |
| CFO dashboard and valuation recalculation | IMPLEMENTED | `src/modules/dashboard/dashboard.controller.ts:33–46`; `src/modules/dashboard/dashboard.service.ts:416–469`. |

## PM

| Capability | Status | Evidence and boundary |
|---|---|---|
| Create/update tasks, PM verification/rejection, closure | IMPLEMENTED | `src/modules/tasks/tasks.controller.ts:129–209`; `src/modules/tasks/tasks.service.ts:226–296`, `:335–412`, `:546–595`, `:687–699`. |
| Squad GitHub repository registration and activity summaries | IMPLEMENTED | `src/modules/squads/squads.controller.ts:119–146`; `src/modules/squads/squads.service.ts:183–356`. GitHub availability and token validity remain runtime dependent. |
| Payroll proposal | IMPLEMENTED | `src/modules/payroll/payroll.controller.ts:89–96`; `src/modules/payroll/payroll.service.ts:125–199`. |
| Client milestone assignment/acceptance actions | IMPLEMENTED | `src/modules/clients/clients.controller.ts:92–118`; `src/modules/clients/clients.service.ts:121–240`. “Client acceptance” is recorded by an internal PM/CEO/CPO endpoint, not a separately authenticated client portal (`src/modules/clients/clients.controller.ts:116–118`). |

## Developer

| Capability | Status | Evidence and boundary |
|---|---|---|
| View assigned tasks, start and flag completion with Git reference | IMPLEMENTED | `src/modules/tasks/tasks.controller.ts:135–175`; `src/modules/tasks/tasks.service.ts:413–455`, `:487–545`. Git proof is format checked; source assigns a synthetic timestamp before the flag rather than checking GitHub commit time (`src/modules/tasks/tasks.service.ts:523–541`). |
| Personal profile, wallet and task/performance views | IMPLEMENTED | `src/modules/auth/auth.controller.ts:103–118`; `src/modules/users/users.controller.ts:100–126`; `src/modules/users/users.service.ts:272–575`; `frontend/app/(console)/profile/page.tsx:21`. |
| Bounty participation | IMPLEMENTED | `src/modules/bounty/bounty.controller.ts:91–110`; `src/modules/bounty/bounty.service.ts:87–154`. |

## CEO and shared governance

| Capability | Status | Evidence and boundary |
|---|---|---|
| Board proposal, voting and CEO decision | IMPLEMENTED | `src/modules/governance/governance.controller.ts:50–70`; `src/modules/governance/governance.service.ts:26–120`. CEO can authorize a decision while still `PROPOSED` (`:96–115`), so board approval is not universally required. |
| Chaos event trigger, resolution and penalty sweeper | IMPLEMENTED | `src/modules/chaos/chaos.controller.ts:53–66`; `src/modules/chaos/chaos.service.ts:25–32`, `:51–203`. Sweeper is process-local. |
| Chain verification, freezes, bonus and production reset | IMPLEMENTED | `src/modules/ledger/ledger.controller.ts:73–81`, `:259–308`; `src/modules/ledger/ledger.service.ts:307–361`; `src/modules/settings/settings.controller.ts:73–81`; `src/modules/settings/settings.service.ts:57–133`. Reset has an environment gate and password/phrase checks. |
| Cross-cutting simulation score and health views | IMPLEMENTED | `src/modules/dashboard/dashboard.controller.ts:15–52`; `src/modules/dashboard/dashboard.service.ts:75–528`. |

## Planned architecture and unresolved claims

| Claim | Status | Source and reason |
|---|---|---|
| Redis queues/caches, TimescaleDB, CASL and Cloudflare R2 backups | PLANNED | `plan/main.md:38–58`, `:1135–1144`; no corresponding runtime dependency or Compose service in `package.json:22–54` and `docker-compose.yml:1–52`. |
| Next.js frontend is deferred to v2 | UNVERIFIED | Stated at `README.md:156–162`, contradicted by existing `frontend/package.json:25–27`, `frontend/app/page.tsx:13–78` and routes under `frontend/app/(console)/`. |
| Previously reported 110/110 rule pass | UNVERIFIED | Historical assertion at `README.md:129`; verification scripts exist (`scripts/full-verify.mjs:1–7`) but were not run, and no current result is established. |
