# Pointfex ERP — Common Software Requirements Specification

**Draft baseline:** 2026-11-07. **Scope:** shared system requirements under ISO/IEC/IEEE 29148 principles. This document is source-grounded, not a claim that a separate deployment has passed acceptance tests. CHRO, CTO, CFO, PM and Developer perspectives reference these IDs; the CPO perspective records unresolved target duties without inventing grants. Current code combines people and product duties under `CPO`; target CHRO and CPO are distinct (`prisma/schema.prisma:14–21`; `docs/srs/DECISIONS.md` DEC-02).

**Requirement convention.** “The system shall” expresses a verifiable obligation. Status is one of `IMPLEMENTED` (source implements the stated behavior), `PARTIAL` (only part is implemented), `PLANNED` (owner decision or project plan commits to it), `PROPOSED` (candidate rule) or `UNVERIFIED` (evidence insufficient). Status does not certify runtime operation. Priority is **TBD** throughout because no approved, requirement-level priority ranking was found in the audit, access or workflow handoffs; it must be assigned during stakeholder review. `TBD` numeric targets are intentionally open. Trace entries identify source files, decisions, audit findings or workflow IDs. The endpoint map is `docs/srs/audit/evidence-map.md`; the current authorization matrix is `docs/srs/access/rbac-matrix.md`.

## 1. Introduction

### 1.1 Purpose

This SRS defines the ERP's common behavior and cross-cutting quality constraints for design, implementation and acceptance. It separates the target product contract from present source behavior and gives stable IDs for later role-specific requirements, diagrams and traceability. The source inventory and local PostgreSQL baseline are in `docs/srs/audit/HANDOFF.md` and `docs/srs/audit/database-baseline.md`.

### 1.2 Scope

The ERP supports identity, squads and membership, sprint work and review, performance records, notices, finance and ledger, governance, client milestones, technical services, telemetry and dashboards. The current backend registers these modules in `src/app.module.ts:40–77`; the linked workflows are `docs/srs/workflows/workflow-catalog.md` WF-01–WF-10. The target uses the Next.js console as primary and treats the API-served static console as transitional (`docs/srs/DECISIONS.md:6`). Which console is deployed remains **UNVERIFIED**.

This common SRS does not assign unresolved approval authority. Target CHRO payroll approval is an owner decision, but payment execution, rejection and other CHRO/CPO transfers remain **UNVERIFIED** (`docs/srs/access/HANDOFF.md`). Perspective documents use these shared requirements and the ABAC policy; [cpo-requirements.md](cpo-requirements.md) keeps undecided CPO duties explicit.

### 1.3 Intended readers and document use

Stakeholders, implementers, reviewers and testers can use the ID, status and trace columns to distinguish behavior available in source from target changes. The source audit did not execute application tests; historical test counts and separate deployment state remain **UNVERIFIED** (`docs/srs/DECISIONS.md:14`; `docs/srs/audit/HANDOFF.md`).

## 2. Overall system description

The ERP is a browser-to-API system with a NestJS application, Prisma/PostgreSQL persistence, Socket.IO events and scheduled jobs. A Next.js/React console and a static console both call the API. Account/ledger records underpin financial flows; `User`, `SquadMembership`, `Task`, `PayrollProposal`, `BoardDecision` and `ClientMilestone` underpin cross-role workflows (`src/main.ts:11–59`; `src/app.module.ts:40–90`; `prisma/schema.prisma:237–410`, `:412–545`, `:754–862`; `docs/srs/audit/architecture-inventory.md`).

The current system has a single `User.role` string, fixed role guards and service-level ownership checks. A custom role name can be stored but does not carry a general permission policy. The target retains multiple descriptive job-role labels per person and uses deny-by-default attribute-based access control (ABAC) with explicit service/action grants assigned directly to people by the CEO (`prisma/schema.prisma:237–250`, `:1042–1052`; `src/common/guards/roles.guard.ts:15–33`; `docs/srs/DECISIONS.md:7–8`). No unknown permission is implied by a role title.

### 2.1 Operating context and boundary

The API exposes JSON over HTTP under a configurable prefix defaulting to `/api/v1`; Swagger documentation is mounted at `/api/docs`. The current static console is served by the API; the Next.js console is a separate application (`src/main.ts:14–35`; `frontend/package.json:5–9`). The current source also defines a `/events` Socket.IO namespace, but connection and room subscription do not enforce identity/ownership (`src/events/events.gateway.ts:18–56`). See section 5 for interface contracts and their gaps.

### 2.2 Core records

Identity and organization use `User`, `Role`, `Invitation`, `Squad` and `SquadMembership`; work uses `Task`, `TaskAssignee`, `TaskAuditEvent` and performance snapshots; finance uses `Account`, `LedgerTransaction`, `LedgerEntry`, `Loan`, `SprintPayout` and `PayrollProposal`; client delivery uses `Client`, `ClientContract` and `ClientMilestone` (`prisma/schema.prisma:237–410`, `:412–545`, `:570–592`, `:811–862`, `:898–981`, `:1042–1052`). The agreed physical schema reference is the local PostgreSQL database specified by `.env.example`, not an uninspected remote deployment (`docs/srs/DECISIONS.md:10`; `docs/srs/audit/database-baseline.md`).

## 3. User classes and stakeholders

| Class | Interest and current/target boundary | Trace |
|---|---|---|
| CHRO | **PLANNED** separate people role; owner assigned target payroll approval. No current system role. Other personnel/finance authority **UNVERIFIED**. | `docs/srs/DECISIONS.md:7`; `docs/srs/access/HANDOFF.md`; `src/modules/roles/roles.service.ts:9–20` |
| CPO | Current combined people/product executive. Target product and remaining people authority **UNVERIFIED** pending split. | `src/modules/users/users.controller.ts:91–136`; `src/modules/clients/clients.controller.ts:70–119`; `docs/srs/access/HANDOFF.md` |
| CTO | Technical quality, certifications, citations and service review in current source. | `src/modules/tasks/tasks.controller.ts:164–185`; `src/modules/certifications/certifications.controller.ts:50–76`; `docs/srs/access/role-definitions.md` |
| CFO | Current financial operations, ledger, payouts, loans and equity. | `src/modules/ledger/ledger.controller.ts:79–221`; `src/modules/sprint-payouts/sprint-payouts.controller.ts:37–57`; `docs/srs/access/role-definitions.md` |
| PM | Squad-scoped work planning/review, payroll proposal and loan request. | `src/modules/tasks/tasks.service.ts:226–480`, `:546–595`; `src/modules/payroll/payroll.service.ts:125–181` |
| Developer | Assigned work, personal records and selected technical participation. | `src/modules/tasks/tasks.service.ts:487–545`; `src/modules/bounty/bounty.service.ts:87–154` |
| CEO | Current executive override and selected final decisions; target job-role label assignment authority. Override scope and segregation of duties need review. | `src/common/guards/roles.guard.ts:27–33`; `src/modules/governance/governance.service.ts:96–120`; `docs/srs/DECISIONS.md:7–8` |
| Other stakeholders | Client organizations, invited workers, system operators and auditors have interests in contract outcomes, enrollment, operation and evidence. An authenticated external client role is **UNVERIFIED**. | `src/modules/clients/clients.controller.ts:70–119`; `src/modules/invitations/invitations.controller.ts:49–59`; `docs/srs/access/role-definitions.md` |

The `Role` catalogue can contain custom names, but current guards recognize only specific fixed names. A squad PM membership is distinct from an organization role (`prisma/schema.prisma:342–355`, `:1042–1052`; `src/modules/roles/roles.service.ts:9–20`; `src/common/guards/roles.guard.ts:15–33`). See `docs/srs/access/role-definitions.md` and `docs/srs/access/rbac-matrix.md` for current operation scopes.

## 4. System architecture and technology stack

| Layer | Current source evidence | Target note |
|---|---|---|
| Web clients | Next.js 14/React 18 separate console and API-served static HTML/JS (`frontend/package.json:5–40`; `src/main.ts:25–26`; `public/app.js:31–74`) | Next.js primary, static transitional (**PROPOSED** product baseline chosen by owner; `docs/srs/DECISIONS.md:6`). |
| API | NestJS 11 on Node/TypeScript, JSON controllers, validation, JWT/role/throttling globals and Swagger (`package.json:22–54`; `src/main.ts:11–35`; `src/app.module.ts:40–90`) | Fixed role checks to ABAC (**PLANNED**; `docs/srs/DECISIONS.md:8`). |
| Persistence | Prisma 5 with PostgreSQL; Compose references PostgreSQL 16 (`prisma/schema.prisma:1–10`; `package.json:22–54`; `docker-compose.yml:1–45`) | Local database is SRS physical baseline; separate deployment **UNVERIFIED** (`docs/srs/DECISIONS.md:10`). |
| Events/jobs | Socket.IO gateway and in-process cron/sweeper (`src/events/events.gateway.ts:18–56`; `src/modules/tasks/tasks.service.ts:210–224`; `src/modules/dashboard/dashboard.service.ts:76–184`; `src/modules/chaos/chaos.service.ts:25–32`) | Redis/BullMQ future (**PLANNED**; `docs/srs/DECISIONS.md:12`). |
| Finance | Double-entry ledger with PostgreSQL locks, idempotency and HMAC chain (`src/modules/ledger/ledger.service.ts:55–183`) | All-or-nothing sprint payout batch **PROPOSED** (`docs/srs/DECISIONS.md:11`). |

Architecture descriptions do not mandate a specific future policy library or future storage product. Capability is the requirement; Redis, BullMQ, TimescaleDB and R2 are recorded future dependencies, not present runtime services (`docs/srs/DECISIONS.md:12`; `package.json:22–54`; `docker-compose.yml:1–52`).

## 5. External interface requirements

| Interface | Current contract and status | Required target/unknown boundary | Trace |
|---|---|---|---|
| Browser UI | **IMPLEMENTED source:** two browser clients call JSON API; Next.js client holds access/refresh tokens in browser storage and retries once after refresh. | Next.js primary **PROPOSED** as the chosen product baseline; deployment, feature parity and browser support **UNVERIFIED**. | `frontend/lib/api.ts:19–102`; `public/app.js:31–74`; `docs/srs/DECISIONS.md:6` |
| HTTP API | **IMPLEMENTED source:** configurable prefix default `/api/v1`, JSON validation, bearer-auth protected routes except `@Public`, Swagger at `/api/docs`. Complete route list is in the evidence map. | Future action/resource policy **PLANNED**. HTTP status/error schema beyond existing filter should be specified in an API reference; this SRS does not invent it. | `src/main.ts:14–35`; `src/app.module.ts:78–83`; `src/common/guards/jwt-auth.guard.ts:15–24`; `docs/srs/audit/evidence-map.md` |
| Events | **PARTIAL:** Socket.IO `/events` publishes studio/squad/user events, but subscribe does not check identity or room ownership. | Authenticated and scoped subscription control is **PROPOSED** pending event visibility policy. | `src/events/events.gateway.ts:18–56`; `docs/srs/access/authorization-gaps.md` GAP-01 |
| Database | **IMPLEMENTED local schema:** Prisma/PostgreSQL models and migrations align to the inspected local baseline. | Separate deployed schema **UNVERIFIED**. | `prisma/schema.prisma:1–10`; `docs/srs/audit/database-baseline.md`; `docs/srs/DECISIONS.md:10` |
| Email | **IMPLEMENTED source:** invitations/password reset use Resend when configured, with simulated delivery otherwise. | Actual mail delivery, sender domain and SLA **UNVERIFIED**. | `src/modules/mail/mail.service.ts:33–85`; `src/modules/invitations/invitations.service.ts:84–133`; `src/modules/auth/auth.service.ts:170–233` |
| GitHub | **IMPLEMENTED source:** squad repository service calls GitHub REST and may use stored token. | Live repository availability and credentials **UNVERIFIED**. | `src/modules/squads/squads.service.ts:183–229`, `:288–356` |
| Telemetry producer | **IMPLEMENTED source:** public ingest route accepts product API key and writes hourly aggregates. | Producer identity beyond key, key rotation and deployment volume **UNVERIFIED**. | `src/modules/telemetry/telemetry.controller.ts:41–49`; `src/modules/telemetry/telemetry.service.ts:25–115` |
| Notice envelope | **PARTIAL:** browser clients put ciphertext and authentication tag together in `data`; the server validates envelope algorithm, key, IV and data length, without requiring a separate `tag`. End-to-end dispatch was not tested. | One versioned, separate-tag envelope is **PLANNED**. | `src/modules/notices/notices.controller.ts:55–70`; `frontend/lib/notice-crypto.ts:74–89`; `public/app.js:2547–2562`; `docs/srs/DECISIONS.md:9` |

## 6. Shared functional requirements

Each row is a single shared obligation. Role authorization belongs in the access policy; these rows do not grant an operation to an actor. `TBD` priority indicates no approved rank, not a low priority.

| ID | Requirement | Priority | Status | Traceability |
|---|---|---|---|---|
| FR-SYS-001 | The system shall authenticate an active user using allowed-domain email and password before issuing an access session. | TBD | IMPLEMENTED | `src/modules/auth/auth.service.ts:51–100`; `src/common/types.ts:26–38` |
| FR-SYS-002 | The system shall rotate a valid refresh token and reject a revoked, reused or invalid refresh token. | TBD | IMPLEMENTED | `src/modules/auth/auth.service.ts:105–153` |
| FR-SYS-003 | The system shall allow an authenticated user to change their own password after verifying the current password. | TBD | IMPLEMENTED | `src/modules/auth/auth.controller.ts:83–87`; `src/modules/auth/auth.service.ts:156–167` |
| FR-SYS-004 | The system shall issue a single-use, expiring password-reset token for an eligible account. | TBD | IMPLEMENTED | `src/modules/auth/auth.service.ts:170–291` |
| FR-SYS-005 | The system shall support invitation acceptance that creates a user, personal wallet and optional preassigned squad membership in one database transaction. | TBD | IMPLEMENTED | `src/modules/invitations/invitations.service.ts:322–430`; WF-01 |
| FR-SYS-006 | The system shall store more than one active descriptive job-role label for a person without replacing another active label. | TBD | PLANNED | `docs/srs/DECISIONS.md` DEC-02; current single field `prisma/schema.prisma:237–250`. FR-SYS-008 prevents labels alone from granting access. |
| FR-SYS-007 | The system shall record the actor, target person, job-role label and time of every CEO label assignment or revocation. | TBD | PLANNED | `docs/srs/DECISIONS.md:7–8`; gap `docs/srs/access/authorization-gaps.md` GAP-07 |
| FR-SYS-008 | The system shall deny a protected operation unless an active direct service/action grant and all applicable subject, resource, state and context predicates pass. | TBD | PLANNED | `docs/srs/DECISIONS.md` DEC-03; current guard `src/common/guards/roles.guard.ts:15–33` |
| FR-SYS-009 | The system shall maintain active and historical squad memberships with role and allocation. | TBD | IMPLEMENTED | `prisma/schema.prisma:342–355`; `src/modules/squads/squads.service.ts:372–523`; WF-01 |
| FR-SYS-010 | The system shall allow an authorized work manager to create a task with squad, sprint, assignee set, story points and optional due date. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.controller.ts:127–151`; `src/modules/tasks/tasks.service.ts:226–285`; WF-02 |
| FR-SYS-011 | The system shall record each task status transition with previous state, new state, actor and time. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:42–69`; `prisma/schema.prisma:466–479`; WF-03 |
| FR-SYS-012 | The system shall route submitted task work through PM review and then CTO quality review before closure. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:11–40`, `:507–699`; WF-03 |
| FR-SYS-013 | The system shall accept a Git commit or pull request as completion evidence when a task deliverable is a code change. | TBD | PLANNED | `docs/srs/DECISIONS.md:13`; current unconditional Git check `src/modules/tasks/tasks.service.ts:507–545` |
| FR-SYS-014 | The system shall accept a relevant artifact, link or written outcome as completion evidence for a non-code task and retain the reviewer decision. | TBD | PLANNED | `docs/srs/DECISIONS.md:13`; current evidence fields `prisma/schema.prisma:412–495` |
| FR-SYS-015 | The system shall calculate and store a developer score for a sprint from the implemented task and review inputs. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:76–144`; `prisma/schema.prisma:898–916`; WF-04 |
| FR-SYS-016 | The system shall calculate and store a PM score for a sprint from the implemented squad task and review inputs. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:145–209`; `prisma/schema.prisma:917–933`; WF-04 |
| FR-SYS-017 | The system shall store a squad payroll proposal with lab, sprint, recipient tier, amount and review state. | TBD | IMPLEMENTED | `src/modules/payroll/payroll.service.ts:125–181`; `prisma/schema.prisma:512–545`; WF-05 |
| FR-SYS-018 | The system shall post an approved payroll as one balanced treasury-to-wallet ledger batch. | TBD | IMPLEMENTED | `src/modules/payroll/payroll.service.ts:200–317`; WF-05 |
| FR-SYS-019 | The system shall store a sprint payout proposal with one ranked item per active squad. | TBD | IMPLEMENTED | `src/modules/sprint-payouts/sprint-payouts.service.ts:24–75`; `prisma/schema.prisma:955–981`; WF-06 |
| FR-SYS-020 | The system shall require a recorded CEO approval before executing a sprint payout proposal. | TBD | IMPLEMENTED | `src/modules/sprint-payouts/sprint-payouts.service.ts:85–118`; WF-06 |
| FR-SYS-021 | The system shall commit every ranked squad's payout posting and the batch executed state together, or commit none. | TBD | PROPOSED | `docs/srs/DECISIONS.md:11`; current gap `src/modules/sprint-payouts/sprint-payouts.service.ts:108–190` |
| FR-SYS-022 | The system shall store an emergency loan request linked to a borrowing squad and its calculated amount due. | TBD | IMPLEMENTED | `src/modules/loans/loans.service.ts:24–60`; `prisma/schema.prisma:570–592`; WF-07 |
| FR-SYS-023 | The system shall record board proposals, votes and final CEO decisions with actor identities. | TBD | IMPLEMENTED | `src/modules/governance/governance.service.ts:26–120`; `prisma/schema.prisma:754–784`; WF-07 |
| FR-SYS-024 | The system shall disburse a loan only after the stored CEO approval condition has been met. | TBD | IMPLEMENTED | `src/modules/loans/loans.service.ts:89–119`; WF-07 |
| FR-SYS-025 | The system shall retain a client milestone's assigned squad, technical review state and internal acceptance state. | TBD | IMPLEMENTED | `src/modules/clients/clients.service.ts:78–90`, `:121–231`; `prisma/schema.prisma:842–862`; WF-08 |
| FR-SYS-026 | The system shall post a milestone's escrow release only when it is in client review, technically approved, assigned to a squad and sufficiently funded. | TBD | IMPLEMENTED | `src/modules/clients/clients.service.ts:151–231`; WF-08 |
| FR-SYS-027 | The system shall provide account and ledger-entry views restricted to the caller's implemented accounting scope. | TBD | IMPLEMENTED | `src/modules/ledger/ledger.controller.ts:165–185`; `docs/srs/access/rbac-matrix.md` |
| FR-SYS-028 | The system shall reject a ledger posting whose debit and credit totals differ. | TBD | IMPLEMENTED | `src/modules/ledger/ledger.service.ts:55–78` |
| FR-SYS-029 | The system shall reject a ledger posting when a debit account lacks sufficient funds and no explicit negative-balance exception applies. | TBD | IMPLEMENTED | `src/modules/ledger/ledger.service.ts:118–139` |
| FR-SYS-030 | The system shall keep a registered product's telemetry totals in hourly records after accepting a matching product API key. | TBD | IMPLEMENTED | `src/modules/telemetry/telemetry.service.ts:25–115`; `prisma/schema.prisma:868–897` |
| FR-SYS-031 | The system shall expose the current sprint value to authenticated users through the API. | TBD | IMPLEMENTED | `src/modules/settings/settings.controller.ts:60–70` |
| FR-SYS-032 | The system shall expose role-scoped dashboard data through the API. | TBD | IMPLEMENTED | `src/modules/dashboard/dashboard.controller.ts:15–52` |
| FR-SYS-033 | The system shall reject a Socket.IO room subscription unless the subscriber is authenticated and authorized for that room. | TBD | PROPOSED | `docs/srs/access/authorization-gaps.md` GAP-01; current `src/events/events.gateway.ts:25–39` |
| FR-SYS-034 | The system shall use the owner-selected versioned notice envelope with separate ciphertext and authentication tag for both browser clients and the API. | TBD | PLANNED | `docs/srs/DECISIONS.md` DEC-04; current envelope differs at `src/modules/notices/notices.controller.ts:55–70`, `frontend/lib/notice-crypto.ts:74–89` |
| FR-SYS-035 | The system shall let an authorized caller read only records within a defined resource-specific visibility scope. | TBD | PROPOSED | `docs/srs/access/authorization-gaps.md` GAP-02; scope policy TBD |
| FR-SYS-036 | The system shall let a CEO with an active grant-administration entitlement assign a direct service/action grant to a named person within an approved resource scope. | TBD | PLANNED | `docs/srs/DECISIONS.md` DEC-03; target policy `docs/srs/access/service-access-policy.md` |
| FR-SYS-037 | The system shall let a CEO with an active grant-administration entitlement revoke a named person's direct service/action grant so it cannot authorize a subsequent protected request. | TBD | PLANNED | `docs/srs/DECISIONS.md` DEC-03; target policy `docs/srs/access/service-access-policy.md` |
| FR-SYS-038 | The system shall record the actor, subject, service/action, scope and time of each direct grant assignment or revocation. | TBD | PLANNED | `docs/srs/DECISIONS.md` DEC-03; target policy `docs/srs/access/service-access-policy.md` |

The shared FR list identifies capabilities and gates; `docs/srs/access/service-access-policy.md` defines the target service/action decision rule. It does not decide that CHRO may disburse payroll, that CEO may perform all CFO operations, or that an internal employee constitutes a client approver. Those decisions remain **UNVERIFIED** (`docs/srs/access/authorization-gaps.md` GAP-03, GAP-04, GAP-09; `docs/srs/workflows/HANDOFF.md`).

### 6.1 Shared business rules

These `BR-` IDs are the normative SRS identifiers. The `BRW-` identifiers in `docs/srs/workflows/business-rules.md` remain analysis references. Each row states one independently checkable rule or closely bound constraint; implementation status follows source evidence. Priority is TBD pending stakeholder ranking.

| ID | Business rule | Priority | Status | Traceability |
|---|---|---|---|---|
| BR-001 | A user's total allocation across active squad memberships shall not exceed 1.00. | TBD | IMPLEMENTED | `src/modules/squads/squads.service.ts:357–370`; BRW-02; WF-01 |
| BR-002 | A squad shall have no more than one active PM membership. | TBD | IMPLEMENTED | `src/modules/squads/squads.service.ts:385–397`, `:485–497`; BRW-02 |
| BR-003 | An active PM squad membership shall have allocation 1.00. | TBD | IMPLEMENTED | `src/modules/squads/squads.service.ts:385–392`, `:470–476`; BRW-02 |
| BR-004 | A newly created squad treasury shall start with a zero balance. | TBD | IMPLEMENTED | `src/modules/squads/squads.service.ts:83–113`; BRW-04 |
| BR-005 | An assigned task with a sprint shall enter `TODO`; a task lacking an assignee shall enter `BACKLOG`. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:248–285`; BRW-05; WF-02 |
| BR-006 | A task shall not move to a status outside the allowed transition map for its current status. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:11–40`; BRW-06; WF-03 |
| BR-007 | Only an assigned task member shall submit task completion evidence. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:498–545`; BRW-07; WF-03 |
| BR-008 | A PM reviewer shall not verify a task when the reviewer is its primary assignee. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:546–565`; BRW-08; WF-03. Collaborator self-review rule is TBD. |
| BR-009 | A CTO-stage reviewer shall not review a task while holding an active membership in its squad. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:597–644`; BRW-08; WF-03 |
| BR-010 | For a code-change task, completion evidence shall include a Git commit or pull request reference. | TBD | PLANNED | `docs/srs/DECISIONS.md:13`; current unconditional check `src/modules/tasks/tasks.service.ts:507–545` |
| BR-011 | For a non-code task, the system shall accept a relevant artifact, link or written outcome as submitted completion evidence, subject to reviewer approval. | TBD | PLANNED | `docs/srs/DECISIONS.md` DEC-08; WF-03 |
| BR-012 | A payroll proposal shall contain no more than one line item for a given user. | TBD | IMPLEMENTED | `src/modules/payroll/payroll.service.ts:136–141`; BRW-11 |
| BR-013 | A payroll proposal's total shall not exceed the configured weekly lab budget. | TBD | IMPLEMENTED | `src/modules/payroll/payroll.service.ts:133–139`; BRW-11 |
| BR-014 | A payroll recipient shall be an active member of the paying squad at approval time. | TBD | IMPLEMENTED | `src/modules/payroll/payroll.service.ts:243–252`; BRW-12; WF-05 |
| BR-015 | The system shall allow no more than one payroll proposal for the same squad and lab number. | TBD | IMPLEMENTED | `src/modules/payroll/payroll.service.ts:155–162`; `prisma/schema.prisma:526–534`; BRW-11 |
| BR-016 | A sprint payout proposal shall rank every active squad exactly once in a contiguous sequence beginning at 1. | TBD | IMPLEMENTED | `src/modules/sprint-payouts/sprint-payouts.service.ts:24–43`; BRW-14; WF-06 |
| BR-017 | A sprint payout shall not be executed before CEO approval is recorded. | TBD | IMPLEMENTED | `src/modules/sprint-payouts/sprint-payouts.service.ts:85–118`; BRW-15; WF-06 |
| BR-018 | A board proposer shall not vote on the same proposal. | TBD | IMPLEMENTED | `src/modules/governance/governance.service.ts:54–73`; BRW-17; WF-07 |
| BR-019 | A pool-funding requester shall not approve their own request. | TBD | IMPLEMENTED | `src/modules/ledger/ledger.controller.ts:210–215`; BRW-21; WF-09 |
| BR-020 | A client milestone shall not release escrow unless CTO approval is recorded and the milestone is in client review. | TBD | IMPLEMENTED | `src/modules/clients/clients.service.ts:151–166`; BRW-19; WF-08 |
| BR-021 | The same idempotency key shall not authorize two different ledger postings. | TBD | IMPLEMENTED | `src/modules/ledger/ledger.service.ts:84–101`; BRW-20 |
| BR-022 | Execution of a sprint payout batch shall commit all ranked squad postings and the final batch state together, or commit none. | TBD | PROPOSED | `docs/srs/DECISIONS.md:11`; current gap `src/modules/sprint-payouts/sprint-payouts.service.ts:108–190` |

**Unresolved rules:** CHRO payroll approval is **PLANNED** by owner answer, but executor, rejector and emergency override are **UNVERIFIED**; external client acceptance proof and CEO unilateral board approval are also **UNVERIFIED**. They are not stated as `BR-` obligations until the business policy is settled (`docs/srs/access/HANDOFF.md`; `docs/srs/workflows/HANDOFF.md`).

## 7. Non-functional requirements

Existing numeric values below are qualified as defaults or current configured limits; they are not invented service-level targets. Targets shown as `TBD` require approval before they can be used as acceptance thresholds.

| ID | Requirement / measurable condition | Priority | Status | Traceability |
|---|---|---|---|---|
| NFR-001 | The system shall default access JWT expiry to 15 minutes when `JWT_EXPIRES_IN` is unset. | TBD | IMPLEMENTED | `src/modules/auth/auth.module.ts:13` |
| NFR-002 | The system shall default refresh JWT expiry to 7 days when `REFRESH_TOKEN_EXPIRES_IN` is unset. | TBD | IMPLEMENTED | `src/modules/auth/auth.service.ts:31–40` |
| NFR-003 | In production, startup shall reject a missing, placeholder or fewer-than-64-character JWT or ledger secret, and reject equal JWT and ledger secrets. | TBD | IMPLEMENTED | `src/env.ts:26–42` |
| NFR-004 | The password-change interface shall reject a new password shorter than 12 characters. | TBD | IMPLEMENTED | `src/modules/auth/auth.controller.ts:44–50`, `:83–87` |
| NFR-005 | The login and forgot-password endpoints shall limit a client to five requests per 60 seconds under the configured throttler. | TBD | IMPLEMENTED | `src/modules/auth/auth.controller.ts:61–66`, `:88–94`; `src/app.module.ts:44–52` |
| NFR-006 | In production, the global HTTP throttler shall limit a client to 500 requests per 60 seconds unless an endpoint specifies another limit. | TBD | IMPLEMENTED | `src/app.module.ts:44–52`, `:78–83` |
| NFR-007 | A ledger posting shall reject amounts with more than two decimal places and unbalanced debit/credit totals. | TBD | IMPLEMENTED | `src/modules/ledger/ledger.service.ts:55–78` |
| NFR-008 | A repeated ledger request with the same idempotency key and identical actor/reference/entries shall return the original transaction; a mismatched reuse shall fail. | TBD | IMPLEMENTED | `src/modules/ledger/ledger.service.ts:84–101` |
| NFR-009 | The current scheduled performance refresh shall run every six hours in a running API process. | TBD | IMPLEMENTED | `src/modules/tasks/tasks.service.ts:209–224`; `src/app.module.ts:51–52` |
| NFR-010 | The current squad metrics refresh shall be scheduled daily at 00:00 UTC in a running API process. | TBD | IMPLEMENTED | `src/modules/dashboard/dashboard.service.ts:75–77`; `src/app.module.ts:51–52` |
| NFR-011 | Under an approved reference workload of **TBD** concurrent users and **TBD** records, 95% of read API requests shall complete within **TBD** milliseconds. | TBD | UNVERIFIED | No target in `docs/srs/audit/HANDOFF.md` or `docs/srs/DECISIONS.md`; workload and latency must be set before acceptance. |
| NFR-012 | The deployed service shall meet a monthly availability target of **TBD%**, excluding a defined maintenance window of **TBD**. | TBD | UNVERIFIED | Deployment and SLO are unverified (`docs/srs/audit/HANDOFF.md`; `docker-compose.yml:1–52`). |
| NFR-013 | Recovery from a database failure shall meet an approved recovery point objective of **TBD** and recovery time objective of **TBD**. | TBD | UNVERIFIED | Future backup capability in `docs/srs/DECISIONS.md:12`; no approved RPO/RTO. |
| NFR-014 | The primary web console shall meet an approved accessibility conformance target of **TBD** across supported browsers **TBD**. | TBD | UNVERIFIED | Primary console decision `docs/srs/DECISIONS.md:6`; supported-browser/accessibility target absent. |
| NFR-015 | The system shall authenticate Socket.IO subscribers and reject any room subscription outside the caller's approved resource scope. | TBD | PROPOSED | `docs/srs/access/authorization-gaps.md` GAP-01; current `src/events/events.gateway.ts:25–39` |
| NFR-016 | The system shall use one versioned X25519/HKDF-SHA-256/AES-256-GCM notice envelope with a separate 16-byte authentication tag and reject unknown versions/algorithms. | TBD | PLANNED | `docs/srs/DECISIONS.md` DEC-04; current envelope differs at `src/modules/notices/notices.controller.ts:55–70`, `frontend/lib/notice-crypto.ts:74–89` |
| NFR-017 | The system shall retain security and financial audit records for an approved duration of **TBD**. | TBD | UNVERIFIED | Current audit records `prisma/schema.prisma:378–410`, `:993–1009`; retention policy unresolved in `docs/srs/access/authorization-gaps.md`. |
| NFR-018 | The system shall restrict retrieval of security and financial audit records to an approved visibility scope of **TBD**. | TBD | UNVERIFIED | Current audit records `prisma/schema.prisma:378–410`, `:993–1009`; visibility policy unresolved in `docs/srs/access/authorization-gaps.md`. |

## 8. System constraints and assumptions

- **Confirmed source constraint:** the current persistence layer is Prisma on PostgreSQL; the local schema in `.env.example` is the owner-selected SRS physical baseline (`prisma/schema.prisma:1–10`; `docs/srs/DECISIONS.md:10`; `docs/srs/audit/database-baseline.md`). A separate deployed database is **UNVERIFIED**.
- **Confirmed source constraint:** the current API process hosts HTTP, Socket.IO and scheduled work; horizontally scaled job/event behavior is **UNVERIFIED** (`src/app.module.ts:40–90`; `src/events/events.gateway.ts:18–56`; `src/modules/tasks/tasks.service.ts:210–224`).
- **Target constraint:** the Next.js console is primary and the static console remains transitional until parity/deployment evidence is collected (**PROPOSED** product baseline, `docs/srs/DECISIONS.md:6`).
- **Target constraint:** distinct CHRO and CPO job labels, multiple labels per person and ABAC are **PLANNED**; no role-specific authority beyond owner decisions is presumed (`docs/srs/DECISIONS.md:7–8`; `docs/srs/access/HANDOFF.md`).
- **Assumption requiring verification:** the configured environment has working mail/GitHub credentials and the expected DNS, TLS, browser and deployment topology. No live integration was exercised in the source audit (`docs/srs/audit/HANDOFF.md`; `docs/srs/audit/architecture-inventory.md`).
- **Open policy:** client acceptance proof, CEO emergency powers, export rights, data retention, production SLO and recovery targets are **UNVERIFIED** (`docs/srs/access/authorization-gaps.md`; `docs/srs/workflows/HANDOFF.md`).

## 9. Dependencies and integrations

| Dependency | Current/target state | Trace |
|---|---|---|
| PostgreSQL | **IMPLEMENTED** current persistence and locking/ledger serialization; local baseline inspected, separate deployment **UNVERIFIED**. | `prisma/schema.prisma:1–10`; `src/modules/ledger/ledger.service.ts:84–183`; `docs/srs/audit/database-baseline.md` |
| Resend | **IMPLEMENTED source** when configured; simulated mail otherwise. Live delivery **UNVERIFIED**. | `src/modules/mail/mail.service.ts:33–70` |
| GitHub REST | **IMPLEMENTED source** repo activity/summary requests; external response/credentials **UNVERIFIED**. | `src/modules/squads/squads.service.ts:183–229`, `:288–356` |
| Socket.IO | **PARTIAL** event delivery interface: publishing/subscription exists, room authorization absent. | `src/events/events.gateway.ts:18–56`; `docs/srs/access/authorization-gaps.md` GAP-01 |
| Product API-key telemetry | **IMPLEMENTED source** ingest and hourly PostgreSQL aggregates; live producers **UNVERIFIED**. | `src/modules/telemetry/telemetry.controller.ts:41–49`; `src/modules/telemetry/telemetry.service.ts:25–115` |
| Redis/BullMQ, TimescaleDB, R2 | **PLANNED** future capabilities, not current runtime dependencies; exact product choices remain design options. | `docs/srs/DECISIONS.md:12`; `plan/main.md:38–58`; `package.json:22–54`; `docker-compose.yml:1–52` |

## 10. Glossary and references

| Term | Meaning in this SRS |
|---|---|
| ABAC | Attribute-based access control: a policy evaluates subject, action, resource and context attributes. This SRS also requires a CEO-managed direct service/action grant as a subject entitlement; job-role labels alone do not grant access (`docs/srs/DECISIONS.md` DEC-03; [NIST SP 800-162](https://csrc.nist.gov/pubs/sp/800/162/upd2/final)). |
| Active squad membership | A `SquadMembership` whose `leftAt` is null; may carry PM or Developer squad role (`prisma/schema.prisma:342–355`). |
| CHRO / CPO / CTO / CFO / PM | Chief Human Resources Officer / Chief Product Officer / Chief Technology Officer / Chief Financial Officer / Project Manager. CHRO is target-only in current source; role definitions are in `docs/srs/access/role-definitions.md`. |
| DPI / PMHI | Stored developer and PM performance scores computed for a sprint (`src/modules/tasks/tasks.service.ts:76–209`). |
| Ledger posting | Balanced debit/credit entry set tied to one transaction and idempotency key (`src/modules/ledger/ledger.service.ts:55–183`). |
| Sprint | Number stored as `CURRENT_SPRINT` and associated with tasks, payroll and payouts; formal closure is **UNVERIFIED** (`src/modules/settings/settings.service.ts:138–140`; `prisma/schema.prisma:412–425`, `:955–981`). |
| Source-level `IMPLEMENTED` | Behavior supported by cited code and module wiring, without a current deployment/test assertion (`docs/srs/WORKING_RULES.md:8–14`). |
| TBD | Value or policy not established by evidence; must be decided before acceptance. |

**Primary references:** `docs/srs/access/service-access-policy.md`; `docs/srs/WORKING_RULES.md`; `docs/srs/DECISIONS.md`; `docs/srs/audit/HANDOFF.md`, `architecture-inventory.md`, `evidence-map.md`, `database-baseline.md`; `docs/srs/access/HANDOFF.md`, `rbac-matrix.md`, `authorization-gaps.md`; `docs/srs/workflows/HANDOFF.md`, `workflow-catalog.md`, `business-rules.md`; `prisma/schema.prisma`; `src/app.module.ts`; `src/main.ts`. Requirement writing follows the necessity, clarity, singularity, verifiability and traceability principles recorded in `docs/srs/WORKING_RULES.md:20–29`.
