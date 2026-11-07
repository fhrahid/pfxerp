# CTO perspective requirements

**Draft, 2026-11-07.** This perspective uses attribute-based access control (ABAC): an operation requires an explicit service/action grant and resource-scope predicates. Job titles describe responsibilities and do not themselves grant access. Current source still uses fixed role guards, so a requirement whose business operation exists but whose service grant does not is **PARTIAL**. Source-level routes and scopes are evidence, not approved target entitlements. Shared identity, task state, ledger, audit and cross-cutting controls are specified once in [common-srs.md](common-srs.md); current access evidence is in [rbac-matrix.md](../access/rbac-matrix.md). Priorities are TBD. No deployment behavior was exercised.

## Objectives, interfaces and scope

Current technical interfaces include task review, certifications, bounty, marketplace, consultancy, citations, milestone audit and CTO dashboard (`src/modules/tasks/tasks.controller.ts:149–209`; `src/modules/certifications/certifications.controller.ts:44–76`; `src/modules/dashboard/dashboard.controller.ts:21–27`). This document specifies the core decision operations; shared task, ledger and identity behavior remains in common SRS. Current CTO reads are sometimes organization-wide; target service scopes for each operation need approval. CTO is also a current board voter and can propose fines; see the current matrix for these separate operations, whose target grants are **UNVERIFIED**.

## Other current technical interfaces

| Interface / operation | Source evidence and current access | Target service grant |
|---|---|---|
| Bounty target creation and report submission | CTO route access; report requires active hunter squad (`src/modules/bounty/bounty.controller.ts:78–96`; `src/modules/bounty/bounty.service.ts:25–61`, `:87–134`). | **UNVERIFIED** scope and grant. |
| Marketplace delisting and purchase | CTO route access; purchase has financial/health checks, while delist records no reason (`src/modules/marketplace/marketplace.controller.ts:52–75`; `src/modules/marketplace/marketplace.service.ts:73–143`). | **UNVERIFIED** grant and maker/checker policy. |
| Consultancy booking/cancellation | CTO route access; cancellation lacks caller ownership test (`src/modules/consultancy/consultancy.controller.ts:37–61`; `src/modules/consultancy/consultancy.service.ts:26–166`). | **UNVERIFIED** grant and scope. |
| Board proposal/vote, fine proposal, product creation and CTO dashboard | Current CTO routes (`src/modules/governance/governance.controller.ts:50–65`; `src/modules/payroll/payroll.controller.ts:120–126`; `src/modules/telemetry/telemetry.controller.ts:51–59`; `src/modules/dashboard/dashboard.controller.ts:21–27`). | **UNVERIFIED** target grants; no authority inferred from title. |

## Functional requirements

Each requirement contains one acceptance obligation. The *related permission* is a proposed service/action name for the target policy, not an existing permission record. A requirement marked PARTIAL has the cited business operation in source but no ABAC enforcement. Unspecified grants remain **UNVERIFIED** and are denied by the target default policy.

### FR-CTO-001 — Read technical review queue

| Field | Requirement detail |
|---|---|
| ID | `FR-CTO-001` |
| Name | Read technical review queue |
| Description | Inspect tasks awaiting technical review. |
| Actor | Technical reviewer |
| Preconditions | Authenticated with tasks.review.read; task is PM_VERIFIED. |
| Trigger | Open pending queue. |
| System behavior | The system shall return only tasks in the grantee’s defined review scope and PM_VERIFIED state. |
| Postconditions | Queue is read without task mutation. |
| Exceptions | Absent grant or out-of-scope task: deny/filter. |
| Related permission | `tasks.review.read`; target grant/scope policy. |
| Implementation status | **PARTIAL — current CTO/CEO route lists PM_VERIFIED tasks, but no service grant.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:149–154`; `src/modules/tasks/tasks.service.ts:708–718`. |

### FR-CTO-002 — Pass task quality review

| Field | Requirement detail |
|---|---|
| ID | `FR-CTO-002` |
| Name | Pass task quality review |
| Description | Approve PM-verified work after conflict check. |
| Actor | Technical reviewer |
| Preconditions | Task PM_VERIFIED; no active membership in its squad. |
| Trigger | Submit pass. |
| System behavior | The system shall record the reviewer and move the task to CTO_VERIFIED when the technical-review grant, state and conflict checks pass. |
| Postconditions | Task has technical approval. |
| Exceptions | Wrong state, active squad membership or no grant: reject. |
| Related permission | `tasks.review.approve`; target grant/scope policy. |
| Implementation status | **PARTIAL — CTO route and conflict gate exist; service grant absent.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:193–198`; `src/modules/tasks/tasks.service.ts:604–639`; WF-03. |

### FR-CTO-003 — Reject task quality review

| Field | Requirement detail |
|---|---|
| ID | `FR-CTO-003` |
| Name | Reject task quality review |
| Description | Return deficient PM-verified work with a citation. |
| Actor | Technical reviewer |
| Preconditions | Task PM_VERIFIED; no active membership in its squad. |
| Trigger | Submit rejection. |
| System behavior | The system shall require a critique of at least 20 characters and citation type, issue the citation, and return the task to IN_PROGRESS. |
| Postconditions | Task and citation record the outcome. |
| Exceptions | Wrong state, conflict, invalid critique, citation/posting failure or no grant: reject or surface partial failure. |
| Related permission | `tasks.review.reject`; target grant/scope policy. |
| Implementation status | **PARTIAL — core path exists; service grant absent and cross-write atomicity unverified.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:101–120`, `:199–204`; `src/modules/tasks/tasks.service.ts:642–691`. |

### FR-CTO-004 — Review certification application

| Field | Requirement detail |
|---|---|
| ID | `FR-CTO-004` |
| Name | Review certification application |
| Description | Decide a pending technical certification. |
| Actor | Certification reviewer |
| Preconditions | Pending application and certifications.review grant. |
| Trigger | Submit approval or rejection. |
| System behavior | The system shall record the decision and reviewer for a pending application using the implemented score and cooldown rules. |
| Postconditions | Certification state updated. |
| Exceptions | Wrong state, invalid score or no grant: reject. |
| Related permission | `certifications.review`; target grant/scope policy. |
| Implementation status | **PARTIAL — CTO review exists, service grant absent.** |
| Evidence | `src/modules/certifications/certifications.controller.ts:48–76`; `src/modules/certifications/certifications.service.ts:54–109`. |

### FR-CTO-005 — Triage bounty report

| Field | Requirement detail |
|---|---|
| ID | `FR-CTO-005` |
| Name | Triage bounty report |
| Description | Verify or reject a cross-squad defect report. |
| Actor | Bounty reviewer |
| Preconditions | Existing report and bounty.triage grant. |
| Trigger | Submit triage. |
| System behavior | The system shall apply the report decision and, on verification, post the implemented escrow/pool effects and performance update. |
| Postconditions | Report decision recorded. |
| Exceptions | Already decided, insufficient funds, invalid report or no grant: reject; partial posting recovery TBD. |
| Related permission | `bounty.triage`; target grant/scope policy. |
| Implementation status | **PARTIAL — route and business effects exist, service grant absent.** |
| Evidence | `src/modules/bounty/bounty.controller.ts:106–111`; `src/modules/bounty/bounty.service.ts:155–241`. |

### FR-CTO-006 — Verify marketplace listing

| Field | Requirement detail |
|---|---|
| ID | `FR-CTO-006` |
| Name | Verify marketplace listing |
| Description | Approve a listed technical asset. |
| Actor | Technical reviewer |
| Preconditions | Listing exists and marketplace.verify grant. |
| Trigger | Submit verification. |
| System behavior | The system shall mark an existing listing verified and retain the reviewer identity. |
| Postconditions | Listing is eligible for purchase under current rules. |
| Exceptions | Missing listing or no grant: reject. Current code does not block verification of a delisted listing. |
| Related permission | `marketplace.verify`; target grant/scope policy. |
| Implementation status | **PARTIAL — CTO route exists, service grant absent.** |
| Evidence | `src/modules/marketplace/marketplace.controller.ts:63–69`; `src/modules/marketplace/marketplace.service.ts:128–136`. |

### FR-CTO-007 — Audit client milestone

| Field | Requirement detail |
|---|---|
| ID | `FR-CTO-007` |
| Name | Audit client milestone |
| Description | Record technical pass/fail before internal acceptance. |
| Actor | Technical auditor |
| Preconditions | Milestone IN_PROGRESS or CTO_AUDIT; clients.audit grant. |
| Trigger | Submit audit result. |
| System behavior | The system shall record pass/fail and move the milestone to CLIENT_REVIEW on pass or IN_PROGRESS on failure. |
| Postconditions | Technical review state updated. |
| Exceptions | Wrong state, missing milestone or no grant: reject. |
| Related permission | `clients.audit`; target grant/scope policy. |
| Implementation status | **PARTIAL — CTO route exists, service grant absent.** |
| Evidence | `src/modules/clients/clients.controller.ts:108–113`; `src/modules/clients/clients.service.ts:131–149`; WF-08. |

### FR-CTO-008 — Issue technical citation

| Field | Requirement detail |
|---|---|
| ID | `FR-CTO-008` |
| Name | Issue technical citation |
| Description | Record a technical citation against a squad/task. |
| Actor | Technical auditor |
| Preconditions | Valid target and audit.citation.create grant. |
| Trigger | Submit citation. |
| System behavior | The system shall create the citation and associated implemented financial/audit records. |
| Postconditions | Citation is recorded. |
| Exceptions | Invalid target, duplicate key, insufficient funds or no grant: reject or report failure. |
| Related permission | `audit.citation.create`; target grant/scope policy. |
| Implementation status | **PARTIAL — CTO route exists, service grant absent.** |
| Evidence | `src/modules/audit/audit.controller.ts:40–46`; `src/modules/audit/audit.service.ts:20–91`. |


## Workflow, data and dependencies

WF-03 uses PM review before CTO quality decision; WF-08 uses CTO audit before internal acceptance; WF-10 links certification, marketplace and consultancy. Inputs are tasks, critiques, certification scores, bounty decisions, listings and milestone audit results; outputs are state changes and audit/ledger records. PM supplies the first task review; CEO currently has route bypass but target override is undecided.

## Errors, audit and unresolved decisions

The task rejection path issues a citation before changing task state, so partial failure recovery is **UNVERIFIED** (`src/modules/tasks/tasks.service.ts:659–691`). The target must record actor, grant, resource and decision for technical approvals; common audit requirements apply. Decide review scope, CTO ability to review own authored listing, CEO exception, technical service purchasing/cancellation scope, and whether current organization-wide reads remain allowed.
