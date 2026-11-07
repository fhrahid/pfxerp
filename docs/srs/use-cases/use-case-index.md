# Use case index and requirement coverage

**Draft, 2026-11-07.** Seven editable PlantUML diagrams are under `../diagrams/use-cases/`: one overall map and CHRO, CPO, CTO, CFO, PM and Developer perspectives. The CPO diagram shows current source actions only; target CPO grants remain UNVERIFIED. Descriptions are split by domain; this index is the coverage ledger. The current RBAC matrix reports source access; target ABAC grants remain separate (`../access/rbac-matrix.md`; `../access/service-access-policy.md`). No `<<include>>` or `<<extend>>` is drawn: the cited workflows are handoffs or state alternatives, not proven mandatory reused subcases or optional extensions.

## Description files

- [Identity](identity.md) — 9 use cases.
- [Work](work.md) — 8 use cases.
- [People](people.md) — 7 use cases.
- [Finance](finance.md) — 14 use cases.
- [Technical](technical.md) — 15 use cases.
- [Clients](clients.md) — 3 use cases.
- [Operations](operations.md) — 10 use cases.

## Use cases

| ID | Goal | Primary actor | Status | Description |
|---|---|---|---|---|
| `UC-CHRO-001` | Review submitted payroll | CHRO | PROPOSED | [people](./people.md#uc-chro-001--review-submitted-payroll) |
| `UC-CHRO-002` | Approve payroll proposal | CHRO | PLANNED | [people](./people.md#uc-chro-002--approve-payroll-proposal) |
| `UC-CTO-001` | Read technical review queue | CTO | PARTIAL | [technical](./technical.md#uc-cto-001--read-technical-review-queue) |
| `UC-CTO-002` | Pass task quality review | CTO | PARTIAL | [technical](./technical.md#uc-cto-002--pass-task-quality-review) |
| `UC-CTO-003` | Reject task quality review | CTO | PARTIAL | [technical](./technical.md#uc-cto-003--reject-task-quality-review) |
| `UC-CTO-004` | Review certification application | CTO | PARTIAL | [technical](./technical.md#uc-cto-004--review-certification-application) |
| `UC-CTO-005` | Triage bounty report | CTO | PARTIAL | [technical](./technical.md#uc-cto-005--triage-bounty-report) |
| `UC-CTO-006` | Verify marketplace listing | CTO | PARTIAL | [technical](./technical.md#uc-cto-006--verify-marketplace-listing) |
| `UC-CTO-007` | Audit client milestone | CTO | PARTIAL | [clients](./clients.md#uc-cto-007--audit-client-milestone) |
| `UC-CTO-008` | Issue technical citation | CTO | PARTIAL | [technical](./technical.md#uc-cto-008--issue-technical-citation) |
| `UC-CFO-001` | Allocate squad funds | CFO | PARTIAL | [finance](./finance.md#uc-cfo-001--allocate-squad-funds) |
| `UC-CFO-002` | Allocate personal funds | CFO | PARTIAL | [finance](./finance.md#uc-cfo-002--allocate-personal-funds) |
| `UC-CFO-003` | Return squad funds | CFO | PARTIAL | [finance](./finance.md#uc-cfo-003--return-squad-funds) |
| `UC-CFO-004` | Request pool funding | CFO | PARTIAL | [finance](./finance.md#uc-cfo-004--request-pool-funding) |
| `UC-CFO-005` | Approve fine proposal | CFO | PARTIAL | [finance](./finance.md#uc-cfo-005--approve-fine-proposal) |
| `UC-CFO-006` | Submit sprint payout | CFO | PARTIAL | [finance](./finance.md#uc-cfo-006--submit-sprint-payout) |
| `UC-CFO-007` | Execute approved sprint payout | CFO | PARTIAL | [finance](./finance.md#uc-cfo-007--execute-approved-sprint-payout) |
| `UC-CFO-008` | Disburse approved loan | CFO | PARTIAL | [finance](./finance.md#uc-cfo-008--disburse-approved-loan) |
| `UC-CFO-009` | Invest in squad equity | CFO | PARTIAL | [finance](./finance.md#uc-cfo-009--invest-in-squad-equity) |
| `UC-PM-001` | Create squad task | PM | PARTIAL | [work](./work.md#uc-pm-001--create-squad-task) |
| `UC-PM-002` | Review submitted squad task | PM | PARTIAL | [work](./work.md#uc-pm-002--review-submitted-squad-task) |
| `UC-PM-003` | Reject submitted squad task | PM | PARTIAL | [work](./work.md#uc-pm-003--reject-submitted-squad-task) |
| `UC-PM-004` | Close technically approved task | PM | PARTIAL | [work](./work.md#uc-pm-004--close-technically-approved-task) |
| `UC-PM-005` | Submit squad payroll | PM | PARTIAL | [people](./people.md#uc-pm-005--submit-squad-payroll) |
| `UC-PM-006` | Apply for squad loan | PM | PARTIAL | [finance](./finance.md#uc-pm-006--apply-for-squad-loan) |
| `UC-PM-007` | Repay squad loan | PM | PARTIAL | [finance](./finance.md#uc-pm-007--repay-squad-loan) |
| `UC-PM-008` | Book consultancy for squad | PM | PARTIAL | [technical](./technical.md#uc-pm-008--book-consultancy-for-squad) |
| `UC-PM-009` | Manage squad repositories | PM | PARTIAL | [operations](./operations.md#uc-pm-009--manage-squad-repositories) |
| `UC-PM-010` | Record internal milestone acceptance | PM | PARTIAL | [clients](./clients.md#uc-pm-010--record-internal-milestone-acceptance) |
| `UC-DEV-001` | Read assigned tasks | DEV | PARTIAL | [work](./work.md#uc-dev-001--read-assigned-tasks) |
| `UC-DEV-002` | Start assigned task | DEV | PARTIAL | [work](./work.md#uc-dev-002--start-assigned-task) |
| `UC-DEV-003` | Submit code task evidence | DEV | PARTIAL | [work](./work.md#uc-dev-003--submit-code-task-evidence) |
| `UC-DEV-004` | Submit non-code task evidence | DEV | PLANNED | [work](./work.md#uc-dev-004--submit-non-code-task-evidence) |
| `UC-DEV-005` | Report cross-squad defect | DEV | PARTIAL | [technical](./technical.md#uc-dev-005--report-cross-squad-defect) |
| `UC-DEV-006` | Apply for technical certification | DEV | PARTIAL | [technical](./technical.md#uc-dev-006--apply-for-technical-certification) |
| `UC-DEV-007` | Complete assigned consultancy | DEV | PARTIAL | [technical](./technical.md#uc-dev-007--complete-assigned-consultancy) |
| `UC-SYS-001` | Sign in | Account holder | IMPLEMENTED | [identity](./identity.md#uc-sys-001--sign-in) |
| `UC-SYS-002` | Change own password | Authenticated user | IMPLEMENTED | [identity](./identity.md#uc-sys-002--change-own-password) |
| `UC-SYS-003` | Reset password | Account holder | IMPLEMENTED | [identity](./identity.md#uc-sys-003--reset-password) |
| `UC-SYS-004` | Accept invitation | Invitee | IMPLEMENTED | [identity](./identity.md#uc-sys-004--accept-invitation) |
| `UC-SYS-005` | Assign descriptive job label | CEO | PLANNED | [identity](./identity.md#uc-sys-005--assign-descriptive-job-label) |
| `UC-SYS-006` | Maintain squad membership | Authorized organization manager | IMPLEMENTED | [identity](./identity.md#uc-sys-006--maintain-squad-membership) |
| `UC-SYS-007` | Execute approved payroll | Payment executor (target TBD) | PARTIAL | [people](./people.md#uc-sys-007--execute-approved-payroll) |
| `UC-SYS-008` | Approve sprint payout | CEO | IMPLEMENTED | [finance](./finance.md#uc-sys-008--approve-sprint-payout) |
| `UC-SYS-009` | Decide board proposal | Board member proposes/votes; CEO finalizes | IMPLEMENTED | [finance](./finance.md#uc-sys-009--decide-board-proposal) |
| `UC-SYS-010` | View accounts and entries | Authorized account viewer | IMPLEMENTED | [finance](./finance.md#uc-sys-010--view-accounts-and-entries) |
| `UC-SYS-011` | Ingest product telemetry | Product telemetry producer | IMPLEMENTED | [operations](./operations.md#uc-sys-011--ingest-product-telemetry) |
| `UC-SYS-012` | View current sprint | Authenticated user | IMPLEMENTED | [operations](./operations.md#uc-sys-012--view-current-sprint) |
| `UC-SYS-013` | View dashboard | Authenticated user; CTO; CFO; CEO | IMPLEMENTED | [operations](./operations.md#uc-sys-013--view-dashboard) |
| `UC-SYS-014` | Subscribe to event room | Authenticated subscriber (target) | PROPOSED | [operations](./operations.md#uc-sys-014--subscribe-to-event-room) |
| `UC-SYS-015` | Exchange secure notice | Notice sender; notice recipient | PLANNED | [operations](./operations.md#uc-sys-015--exchange-secure-notice) |
| `UC-SYS-016` | Manage client contract and milestone | Current CEO/CPO/CFO create/fund; PM adds/assigns only | IMPLEMENTED | [clients](./clients.md#uc-sys-016--manage-client-contract-and-milestone) |
| `UC-SYS-017` | Create marketplace listing | Certified author | IMPLEMENTED | [technical](./technical.md#uc-sys-017--create-marketplace-listing) |
| `UC-SYS-018` | Purchase marketplace listing | Current PM/CTO/CEO buyer | IMPLEMENTED | [technical](./technical.md#uc-sys-018--purchase-marketplace-listing) |
| `UC-SYS-019` | Create bounty target | Current PM/CTO/CEO | IMPLEMENTED | [technical](./technical.md#uc-sys-019--create-bounty-target) |
| `UC-SYS-020` | Cancel consultancy booking | Current PM/CTO/CEO | IMPLEMENTED | [technical](./technical.md#uc-sys-020--cancel-consultancy-booking) |
| `UC-SYS-021` | Invite worker | Current CEO/CFO/CTO/CPO | IMPLEMENTED | [identity](./identity.md#uc-sys-021--invite-worker) |
| `UC-SYS-022` | Read performance score | Authenticated user | IMPLEMENTED | [operations](./operations.md#uc-sys-022--read-performance-score) |
| `UC-SYS-023` | Set current sprint | Current CEO/CFO/CTO/CPO | IMPLEMENTED | [operations](./operations.md#uc-sys-023--set-current-sprint) |
| `UC-SYS-024` | Resolve squad chaos event | Current PM/CEO | IMPLEMENTED | [operations](./operations.md#uc-sys-024--resolve-squad-chaos-event) |
| `UC-SYS-025` | Create fine proposal | Current CTO/CPO/CEO | IMPLEMENTED | [people](./people.md#uc-sys-025--create-fine-proposal) |
| `UC-SYS-026` | Reject payroll proposal | Current CPO/CEO | IMPLEMENTED | [people](./people.md#uc-sys-026--reject-payroll-proposal) |
| `UC-SYS-027` | Manage own user profile | Authenticated user | IMPLEMENTED | [identity](./identity.md#uc-sys-027--manage-own-user-profile) |
| `UC-SYS-028` | Create product | Current PM/CTO/CPO/CEO | IMPLEMENTED | [operations](./operations.md#uc-sys-028--create-product) |

| `UC-SYS-029` | Delist marketplace listing | Current CTO/CEO | IMPLEMENTED | [technical](./technical.md#uc-sys-029--delist-marketplace-listing) |
| `UC-SYS-030` | Recalculate valuations | Current CFO/CEO | IMPLEMENTED | [operations](./operations.md#uc-sys-030--recalculate-valuations) |
| `UC-SYS-031` | Manage worker account | Current CPO/CEO | IMPLEMENTED | [identity](./identity.md#uc-sys-031--manage-worker-account) |
| `UC-SYS-032` | Manage system setting | Current CEO | IMPLEMENTED | [operations](./operations.md#uc-sys-032--manage-system-setting) |
| `UC-SYS-033` | View certification directory | Authenticated user | IMPLEMENTED | [technical](./technical.md#uc-sys-033--view-certification-directory) |
| `UC-SYS-034` | Manage direct service grants | CEO | PLANNED | [identity](./identity.md#uc-sys-034--manage-direct-service-grants) |

## Functional requirement coverage

| Requirement | Use case or explicit non-interactive classification |
|---|---|
| `FR-SYS-001` | `UC-SYS-001` |
| `FR-SYS-002` | Non-interactive — Automatic refresh-token rotation within the sign-in/session interaction (UC-SYS-001). |
| `FR-SYS-003` | `UC-SYS-002` |
| `FR-SYS-004` | `UC-SYS-003` |
| `FR-SYS-005` | `UC-SYS-004` |
| `FR-SYS-006` | `UC-SYS-005` |
| `FR-SYS-007` | `UC-SYS-005` |
| `FR-SYS-008` | Non-interactive — Cross-cutting service authorization predicate checked by every protected use case. |
| `FR-SYS-009` | `UC-SYS-006` |
| `FR-SYS-010` | `UC-PM-001` |
| `FR-SYS-011` | Non-interactive — Internal audit event on task transitions; linked to work use cases. |
| `FR-SYS-012` | `UC-PM-002`, `UC-CTO-002` |
| `FR-SYS-013` | `UC-DEV-003` |
| `FR-SYS-014` | `UC-DEV-004` |
| `FR-SYS-015` | Non-interactive — Scheduled/internal Developer score computation; users may read results via UC-SYS-022. |
| `FR-SYS-016` | Non-interactive — Scheduled/internal PM score computation; users may read results via UC-SYS-022. |
| `FR-SYS-017` | `UC-PM-005` |
| `FR-SYS-018` | `UC-SYS-007` |
| `FR-SYS-019` | `UC-CFO-006` |
| `FR-SYS-020` | `UC-SYS-008` |
| `FR-SYS-021` | Non-interactive — Transaction atomicity constraint on UC-CFO-007, not an actor goal. |
| `FR-SYS-022` | `UC-PM-006` |
| `FR-SYS-023` | `UC-SYS-009` |
| `FR-SYS-024` | `UC-CFO-008` |
| `FR-SYS-025` | `UC-SYS-016`, `UC-CTO-007`, `UC-PM-010` |
| `FR-SYS-026` | `UC-PM-010` |
| `FR-SYS-027` | `UC-SYS-010` |
| `FR-SYS-028` | Non-interactive — Ledger balancing constraint on finance/payment use cases. |
| `FR-SYS-029` | Non-interactive — Insufficient-funds constraint on finance/payment use cases. |
| `FR-SYS-030` | `UC-SYS-011` |
| `FR-SYS-031` | `UC-SYS-012` |
| `FR-SYS-032` | `UC-SYS-013` |
| `FR-SYS-033` | `UC-SYS-014` |
| `FR-SYS-034` | `UC-SYS-015` |
| `FR-SYS-035` | Non-interactive — Cross-cutting read-scope predicate on all read use cases. |
| `FR-SYS-036` | `UC-SYS-034` |
| `FR-SYS-037` | `UC-SYS-034` |
| `FR-SYS-038` | `UC-SYS-034` |
| `FR-CHRO-001` | `UC-CHRO-001` |
| `FR-CHRO-002` | `UC-CHRO-002` |
| `FR-CHRO-003` | `UC-SYS-007` (policy gate within payment execution; no separate actor goal) |
| `FR-CTO-001` | `UC-CTO-001` |
| `FR-CTO-002` | `UC-CTO-002` |
| `FR-CTO-003` | `UC-CTO-003` |
| `FR-CTO-004` | `UC-CTO-004` |
| `FR-CTO-005` | `UC-CTO-005` |
| `FR-CTO-006` | `UC-CTO-006` |
| `FR-CTO-007` | `UC-CTO-007` |
| `FR-CTO-008` | `UC-CTO-008` |
| `FR-CFO-001` | `UC-CFO-001` |
| `FR-CFO-002` | `UC-CFO-002` |
| `FR-CFO-003` | `UC-CFO-003` |
| `FR-CFO-004` | `UC-CFO-004` |
| `FR-CFO-005` | `UC-CFO-005` |
| `FR-CFO-006` | `UC-CFO-006` |
| `FR-CFO-007` | `UC-CFO-007` |
| `FR-CFO-008` | `UC-CFO-008` |
| `FR-CFO-009` | `UC-CFO-009` |
| `FR-PM-001` | `UC-PM-001` |
| `FR-PM-002` | `UC-PM-002` |
| `FR-PM-003` | `UC-PM-003` |
| `FR-PM-004` | `UC-PM-004` |
| `FR-PM-005` | `UC-PM-005` |
| `FR-PM-006` | `UC-PM-006` |
| `FR-PM-007` | `UC-PM-007` |
| `FR-PM-008` | `UC-PM-008` |
| `FR-PM-009` | `UC-PM-009` |
| `FR-PM-010` | `UC-PM-010` |
| `FR-DEV-001` | `UC-DEV-001` |
| `FR-DEV-002` | `UC-DEV-002` |
| `FR-DEV-003` | `UC-DEV-003` |
| `FR-DEV-004` | `UC-DEV-004` |
| `FR-DEV-005` | `UC-DEV-005` |
| `FR-DEV-006` | `UC-DEV-006` |
| `FR-DEV-007` | `UC-DEV-007` |

## Permission and actor validation

| Perspective / actor | Current RBAC and service check | Diagram interpretation |
|---|---|---|
| CHRO | No system role or route; current CPO/CEO payroll approval also disburses (`../access/rbac-matrix.md`, Payroll proposals row). | Payroll review is PROPOSED, approval PLANNED; no current CHRO grant. |
| CPO | Current source role combines worker, squad, payroll, notice, product, client and board actions (`../access/role-definitions.md`). | [CPO perspective](../requirements/cpo-requirements.md) and diagram show current actions; target CPO grants and scopes remain UNVERIFIED. |
| CTO | Current technical review, certification, bounty triage, listing verification, citation and milestone audit routes are CTO-gated; task review also checks active squad conflict (`../access/rbac-matrix.md`, Tasks, Certifications, Bounty, Marketplace, Citations and Clients rows). | CTO associations show source operations; target service grants remain separate. |
| CFO | Current ledger, fine, loan, equity and payout routes are CFO-gated. CEO bypass reaches several CFO routes, but fine approval service checks CFO (`../access/rbac-matrix.md`, Accounts, Fines, Loans, Equity and Sprint payouts rows). | CFO associations do not carry CEO override into target ABAC. |
| PM | Current work, payroll and loan actions require active squad PM relationship; marketplace purchase is own-squad. Consultancy cancellation lacks a booking ownership check (`../access/rbac-matrix.md`, Tasks, Payroll, Loans, Marketplace and Consultancy rows). | PM associations retain the documented scope/gap; target cancellation permission is unresolved. |
| Developer | Current task start/submit needs assignment; bounty report needs active hunter squad; consultancy completion needs the assigned consultant (`../access/rbac-matrix.md`, Tasks, Bounty and Consultancy rows). | Developer associations do not imply organization-wide read permissions. |
| CEO / CPO / board / external actors | CEO approves payout and finalizes governance; CPO currently handles people/product routes; board proposer cannot vote on own proposal; product telemetry uses API key (`../access/rbac-matrix.md`, Sprint payouts, Board, Users and Products rows). | Supporting actors appear for their own steps. Client acceptance is internal, not an authenticated external-client action. |

- **Current RBAC:** CHRO has no current route. CHRO diagrams and UC-CHRO-001/002 are target-only; current CPO/CEO payroll approval also disburses (`../access/rbac-matrix.md`, Payroll proposals row).
- **Current supporting actors:** CEO approves payout; CFO submits/executes it. PM submits payroll; current CPO/CEO approves/disburses; CHRO approval is planned. CTO audits after PM task review; assigned consultant completes a booking. These are separate actor actions, not `<<include>>` links.
- **Target ABAC:** a job label conveys no grant. Every protected target use case requires its service/action grant and resource predicates. Current broad reads and CEO override are not carried forward as automatic permissions.
- **Unresolved:** grant scope values and provisioning details, CHRO payroll review scope/executor/rejector, CEO override, read/export scopes and external client acceptance remain UNVERIFIED. CEO direct grant administration is PLANNED by DEC-03.

Coverage count: 75 functional requirements; 0 missing explicit coverage. The diagrams and descriptions contain 70 user-facing use cases; FR-CHRO-003 is a gate on UC-SYS-007, not a separate actor goal.
