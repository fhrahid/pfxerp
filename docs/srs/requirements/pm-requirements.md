# PM perspective requirements

**Draft, 2026-11-07.** This perspective uses attribute-based access control (ABAC): an operation requires an explicit service/action grant and resource-scope predicates. Job titles describe responsibilities and do not themselves grant access. Current source still uses fixed role guards, so a requirement whose business operation exists but whose service grant does not is **PARTIAL**. Source-level routes and scopes are evidence, not approved target entitlements. Shared identity, task state, ledger, audit and cross-cutting controls are specified once in [common-srs.md](common-srs.md); current access evidence is in [rbac-matrix.md](../access/rbac-matrix.md). Priorities are TBD. No deployment behavior was exercised.

## Objectives, interfaces and scope

PM is a squad-scoped work manager in current source. Interfaces include tasks, payroll proposals, loans, repositories, marketplace/consultancy, milestones, bounty targets, products and chaos resolution (`src/modules/tasks/tasks.controller.ts:129–209`; `docs/srs/access/rbac-matrix.md`). Target permissions require explicit service grants plus active squad relationship. Shared task transition/audit requirements remain FR-SYS-010–016; shared payroll/loan/ledger state remains in the common SRS. Marketplace buying, bounty target creation, product creation and chaos resolution exist in source but target grants/scopes still need policy review.

## Other current PM interfaces

| Interface / operation | Source evidence and current access | Target service grant |
|---|---|---|
| Task update/assignment and personal start/submit | PM can update own-squad tasks; assignee can start/submit (`src/modules/tasks/tasks.controller.ts:162–180`; `src/modules/tasks/tasks.service.ts:286–412`, `:487–545`). | Candidate `tasks.update` and `tasks.submit`; scope decision **UNVERIFIED** beyond active squad/assignment. |
| Marketplace purchase and bounty target creation | PM buying is own-squad gated; PM may fund own-squad bounty target (`src/modules/marketplace/marketplace.controller.ts:52–61`; `src/modules/marketplace/marketplace.service.ts:73–126`; `src/modules/bounty/bounty.service.ts:25–61`). | **UNVERIFIED** target financial grants. |
| Client milestone creation/assignment, product creation, chaos resolution | PM routes exist; milestone assignment lacks PM squad check; product/chaos have respective checks (`src/modules/clients/clients.controller.ts:92–107`; `src/modules/clients/clients.service.ts:121–129`; `src/modules/telemetry/telemetry.controller.ts:51–59`; `src/modules/chaos/chaos.service.ts:133–140`). | **UNVERIFIED** target grants and scope. |
| Consultancy cancellation | PM route exists but service does not verify booking ownership (`src/modules/consultancy/consultancy.controller.ts:59–61`; `src/modules/consultancy/consultancy.service.ts:140–166`). | **UNVERIFIED** target grant; do not inherit current cross-squad reach. |

## Functional requirements

Each requirement contains one acceptance obligation. The *related permission* is a proposed service/action name for the target policy, not an existing permission record. A requirement marked PARTIAL has the cited business operation in source but no ABAC enforcement. Unspecified grants remain **UNVERIFIED** and are denied by the target default policy.

### FR-PM-001 — Create squad task

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-001` |
| Name | Create squad task |
| Description | Plan work for an assigned squad. |
| Actor | Squad work manager |
| Preconditions | Active PM membership for squad; tasks.create grant. |
| Trigger | Submit task. |
| System behavior | The system shall create the task with squad, sprint, assignees, points and due date after scope validation. |
| Postconditions | Task exists in planned state. |
| Exceptions | Nonmember, invalid assignee, invalid fields or no grant: reject. |
| Related permission | `tasks.create`; target grant/scope policy. |
| Implementation status | **PARTIAL — current PM path exists, grant absent.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:129–133`; `src/modules/tasks/tasks.service.ts:226–285`; WF-02. |

### FR-PM-002 — Review submitted squad task

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-002` |
| Name | Review submitted squad task |
| Description | Perform first review of flagged work. |
| Actor | Squad reviewer |
| Preconditions | Task FLAGGED_COMPLETE, active PM membership, not primary assignee. |
| Trigger | Submit pass decision. |
| System behavior | The system shall record PM reviewer and move the task to PM_VERIFIED. |
| Postconditions | Task awaits technical review. |
| Exceptions | Self-review, wrong state, other squad or no grant: reject. |
| Related permission | `tasks.review.pmApprove`; target grant/scope policy. |
| Implementation status | **PARTIAL — current PM path exists, grant absent.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:181–186`; `src/modules/tasks/tasks.service.ts:546–568`; WF-03. |

### FR-PM-003 — Reject submitted squad task

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-003` |
| Name | Reject submitted squad task |
| Description | Return flagged work with feedback. |
| Actor | Squad reviewer |
| Preconditions | Task FLAGGED_COMPLETE, active PM membership. |
| Trigger | Submit rejection. |
| System behavior | The system shall require feedback and return task to IN_PROGRESS, recording premature-flag indication and applicable score effects. |
| Postconditions | Assignee can continue work. |
| Exceptions | Wrong state, other squad, invalid feedback or no grant: reject. |
| Related permission | `tasks.review.pmReject`; target grant/scope policy. |
| Implementation status | **PARTIAL — current PM path exists, grant absent.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:188–192`; `src/modules/tasks/tasks.service.ts:571–601`; WF-03. |

### FR-PM-004 — Close technically approved task

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-004` |
| Name | Close technically approved task |
| Description | Finish a task after technical review. |
| Actor | Squad work manager |
| Preconditions | Task CTO_VERIFIED and assigned PM scope. |
| Trigger | Request close. |
| System behavior | The system shall transition task to CLOSED and retain actor/time. |
| Postconditions | Task is closed. |
| Exceptions | Wrong state, other squad or no grant: reject. |
| Related permission | `tasks.close`; target grant/scope policy. |
| Implementation status | **PARTIAL — PM/CTO path exists, grant absent.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:205–209`; `src/modules/tasks/tasks.service.ts:694–706`. |

### FR-PM-005 — Submit squad payroll

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-005` |
| Name | Submit squad payroll |
| Description | Propose payroll for active squad members. |
| Actor | Squad PM |
| Preconditions | Active PM membership, line items valid, payroll.submit grant. |
| Trigger | Submit proposal. |
| System behavior | The system shall reject duplicate recipients, nonmembers, tier-cap and budget violations before storing the proposal. |
| Postconditions | Proposal is SUBMITTED for CHRO decision. |
| Exceptions | Existing lab proposal, invalid amount or no grant: reject. |
| Related permission | `payroll.submit`; target grant/scope policy. |
| Implementation status | **PARTIAL — PM operation exists, grant absent; target CHRO handoff planned.** |
| Evidence | `src/modules/payroll/payroll.controller.ts:89–93`; `src/modules/payroll/payroll.service.ts:125–181`; WF-05. |

### FR-PM-006 — Apply for squad loan

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-006` |
| Name | Apply for squad loan |
| Description | Request emergency finance for own squad. |
| Actor | Squad PM |
| Preconditions | Active PM membership, eligible treasury, loans.apply grant. |
| Trigger | Submit loan request. |
| System behavior | The system shall validate threshold and existing-loan conditions and create the loan request. |
| Postconditions | Loan awaits governance and funding. |
| Exceptions | Other squad, sufficient treasury, active loan or no grant: reject. |
| Related permission | `loans.apply`; target grant/scope policy. |
| Implementation status | **PARTIAL — PM operation exists, grant absent.** |
| Evidence | `src/modules/loans/loans.controller.ts:23–27`; `src/modules/loans/loans.service.ts:24–60`; WF-07. |

### FR-PM-007 — Repay squad loan

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-007` |
| Name | Repay squad loan |
| Description | Return principal and interest from own squad treasury. |
| Actor | Squad PM |
| Preconditions | Disbursed active loan, sufficient treasury, loans.repay grant. |
| Trigger | Submit repayment. |
| System behavior | The system shall post principal and interest and mark loan REPAID. |
| Postconditions | Loan settled. |
| Exceptions | Other squad, wrong state, insufficient balance or no grant: reject. |
| Related permission | `loans.repay`; target grant/scope policy. |
| Implementation status | **PARTIAL — PM operation exists, grant absent.** |
| Evidence | `src/modules/loans/loans.controller.ts:40–43`; `src/modules/loans/loans.service.ts:147–195`. |

### FR-PM-008 — Book consultancy for squad

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-008` |
| Name | Book consultancy for squad |
| Description | Reserve certified technical support. |
| Actor | Squad PM |
| Preconditions | Own active squad, eligible consultant/time, consultancy.book grant. |
| Trigger | Submit booking. |
| System behavior | The system shall validate certification, health, technical tier, future time and weekly cap before escrow transfer and booking. |
| Postconditions | Booking scheduled. |
| Exceptions | Other squad, invalid time, cap, insufficient treasury or no grant: reject. |
| Related permission | `consultancy.book`; target grant/scope policy. |
| Implementation status | **PARTIAL — PM operation exists, grant absent.** |
| Evidence | `src/modules/consultancy/consultancy.controller.ts:37–41`; `src/modules/consultancy/consultancy.service.ts:26–94`; WF-10. |

### FR-PM-009 — Manage squad repositories

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-009` |
| Name | Manage squad repositories |
| Description | Associate a Git repository with the assigned squad. |
| Actor | Squad PM |
| Preconditions | Active PM membership; squads.repositories.manage grant. |
| Trigger | Add or remove repository. |
| System behavior | The system shall validate squad ownership and record the repository change without exposing stored token in list output. |
| Postconditions | Squad repository set updated. |
| Exceptions | Other squad, invalid repository or no grant: reject. |
| Related permission | `squads.repositories.manage`; target grant/scope policy. |
| Implementation status | **PARTIAL — PM route exists, grant absent.** |
| Evidence | `src/modules/squads/squads.controller.ts:125–137`; `src/modules/squads/squads.service.ts:188–278`. |

### FR-PM-010 — Record internal milestone acceptance

| Field | Requirement detail |
|---|---|
| ID | `FR-PM-010` |
| Name | Record internal milestone acceptance |
| Description | Attest a milestone for an assigned squad after technical pass. |
| Actor | Squad PM |
| Preconditions | Assigned squad, CTO pass, clients.acceptInternal grant. |
| Trigger | Submit acceptance. |
| System behavior | The system shall record the internal acceptance and release escrow only when shared milestone conditions hold. |
| Postconditions | Milestone paid or disputed. |
| Exceptions | Other squad, no technical pass, insufficient escrow or no grant: reject. |
| Related permission | `clients.acceptInternal`; target grant/scope policy. |
| Implementation status | **PARTIAL — internal PM path exists, grant absent; external client approval absent.** |
| Evidence | `src/modules/clients/clients.controller.ts:116–119`; `src/modules/clients/clients.service.ts:151–231`; WF-08. |


## Workflow, data and dependencies

WF-02/03: PM plans and first-reviews squad tasks; Developer submits work; CTO audits. WF-05: PM prepares payroll; CHRO approval is planned. WF-07: PM requests/repays loan; board, CEO and CFO intervene. WF-08: PM internal milestone attestation follows CTO pass, but no external client proof exists. WF-10: PM books technical help. Inputs and outputs are named in the requirements and shared workflow catalog.

## Errors, audit and unresolved decisions

Current code rejects PM self-verification of the primary assignee task, but the PM rejection method lacks the same explicit self-check (`src/modules/tasks/tasks.service.ts:546–601`); target conflict policy is TBD. Current consultancy cancellation lacks booking ownership check (`src/modules/consultancy/consultancy.service.ts:140–166`), so no target cancellation grant is inferred. Decide PM task review conflict rules, milestone attestation proof, client acceptance authority, marketplace/consultancy scope, and whether broad task/client reads remain. Audit target decisions through shared policy.
