# Open questions and evidence gaps

The owner answered these audit questions on 2026-11-07. Target decisions are recorded in `docs/srs/DECISIONS.md`; they do not change source-grounded feature statuses. The original questions below remain for traceability.

## Dispositions

| Audit item | Current disposition | Remaining evidence or decision |
|---|---|---|
| OQ-01 | **PROPOSED:** Next.js primary target, static console transitional (`DEC-01`). Both exist (`frontend/app/page.tsx:13`, `src/main.ts:25–26`). | Deployment usage and parity are `UNVERIFIED`. |
| OQ-02 | **PLANNED:** CHRO and CPO distinct; one person may hold both (`DEC-02`). Current code has `CPO` only (`prisma/schema.prisma:14–21`). | Define separate permission sets. |
| OQ-03 | **PLANNED:** CEO assigns any system/new job label; multi-label users; ABAC with mandatory direct per-person grants (`DEC-02`, `DEC-03`). Current guard uses fixed role names (`src/common/guards/roles.guard.ts:15–33`). | Define grant scopes, administrator bootstrap, resource attributes and migration from `User.role`. |
| OQ-04 | **PLANNED:** one versioned, explicit-tag notice envelope (`DEC-04`). Current browsers combine tag with ciphertext in `data`; dispatch does not require a separate `tag` (`frontend/lib/notice-crypto.ts:74–89`, `src/modules/notices/notices.controller.ts:55–70`). | Specify old-notice compatibility and acceptance criteria; end-to-end behavior remains UNVERIFIED. |
| OQ-05 | **IMPLEMENTED local schema evidence:** the owner chose PostgreSQL from `.env.example:10–13`; read-only catalog inspection is in `database-baseline.md` (`DEC-05`). | Any separate deployed database is `UNVERIFIED`. Column types and indexes were outside this snapshot. |
| OQ-06 | **PROPOSED:** all-or-nothing payout batch (`DEC-06`) to avoid partially paid rankings. Current code posts per squad (`src/modules/sprint-payouts/sprint-payouts.service.ts:108–190`). | Confirm before treating this policy as approved. |
| OQ-07 | **PLANNED future requirements:** Redis, BullMQ, TimescaleDB, ABAC capability and R2 backups (`DEC-07`). Current manifests omit them (`package.json:22–54`, `docker-compose.yml:1–52`). | Choose technology and migration stages later. |
| OQ-08 | **PLANNED:** Git proof for code tasks; other tasks use relevant artifacts or outcomes plus review (`DEC-08`). Current task method always requires Git proof (`src/modules/tasks/tasks.service.ts:507–541`). | Define task types and evidence formats. |
| OQ-09 | **UNVERIFIED:** historical `README.md:129` pass count is not current evidence (`DEC-09`). | Obtain a scoped current verification record only if later needed. |

## Original audit questions

| ID | Question | Evidence and precise next read |
|---|---|---|
| OQ-01 | Which console is the product baseline for the SRS: the API-served `public/` console, the separate Next.js console, or both? | Both are wired in source (`src/main.ts:25–26`, `public/app.js:4`, `frontend/app/page.tsx:13`, `frontend/components/shell.tsx:48–67`). `README.md:162` still says Next.js is deferred. Review `DEPLOY.md:97–114` and actual deployment configuration with the owner. |
| OQ-02 | Should the normative role name be CHRO, CPO, or “CHRO (CPO)” everywhere? | `plan/chro.md:1–4` uses both; the code uses `CPO` in the fixed `UserRole` enum and guard helpers (`prisma/schema.prisma:14–21`, `src/common/types.ts:10–11`). |
| OQ-03 | What permissions, if any, should newly created custom roles receive? | Role records and custom invitations are implemented (`src/modules/roles/roles.service.ts:70–102`, `src/modules/invitations/invitations.service.ts:28–133`), while `@Roles` and executive helpers use fixed names (`src/common/guards/roles.guard.ts:15–33`, `src/common/types.ts:10–24`). Review each intended custom-role capability before specifying one. |
| OQ-04 | Which encrypted notice envelope is intended, and should one client or server contract change? | Both browser clients use `data` without separate `tag` (`frontend/lib/notice-crypto.ts:74–89`, `public/app.js:2547–2562`). **Correction after source review:** server dispatch validates other envelope fields but does not require `tag` (`src/modules/notices/notices.controller.ts:55–70`). Review the test helper `scripts/notice-crypto.mjs:1–41` and the notice contract in `plan/chro.md:55–64`. |
| OQ-05 | Which database baseline should later SRS traceability use: current Prisma schema, initial migration plus the untracked alignment migration, or a deployed database snapshot? | `prisma/schema.prisma:1–10`, `prisma/migrations/20261107000000_align_schema/migration.sql:1–120`; API startup uses `db push` (`Dockerfile:51–55`). No live database or migration history was read. |
| OQ-06 | Should the SRS describe the current per-squad sprint payout behavior or require an all-or-nothing batch? | `README.md:81` says “atomic waterfall”; `src/modules/sprint-payouts/sprint-payouts.service.ts:108–190` posts in a loop and marks the batch executed afterward. The desired failure/retry contract needs owner direction. |
| OQ-07 | Are Redis, BullMQ, TimescaleDB, CASL and Cloudflare R2 still approved future requirements, or historical design ideas? | They appear in `plan/main.md:38–58`, `plan/security.md:137–239`, `plan/cto.md:795–812`, and `plan/other.md:57–130` but not in the current runtime dependencies/services (`package.json:22–54`, `docker-compose.yml:1–52`). |
| OQ-08 | Is Git proof intended to be validated against the remote repository, including actual commit time? | `src/modules/tasks/tasks.service.ts:507–541` checks the reference format and supplies a timestamp one second before flagging; GitHub reads are in a separate squad repository service (`src/modules/squads/squads.service.ts:183–356`). |
| OQ-09 | Which claimed test results and deployed integrations can be treated as current evidence? | `README.md:111–129` reports an earlier verification result. The audit did not run tests, query a deployed API/DB, or check Resend/GitHub credentials. Runtime status remains `UNVERIFIED`. |

## Follow-up evidence priorities

1. Use `docs/srs/DECISIONS.md` for target scope and `database-baseline.md` for the local physical schema.
2. Keep OQ-06 as a proposed financial rule pending owner confirmation; treat separate deployment state and current test claims as unverified.
3. Read the exact controller DTOs and service checks linked in [evidence-map.md](evidence-map.md) when drafting each requirement; this audit maps the source but does not replace contract-level analysis.
