# CFO perspective requirements

**Draft, 2026-11-07.** This perspective uses attribute-based access control (ABAC): an operation requires an explicit service/action grant and resource-scope predicates. Job titles describe responsibilities and do not themselves grant access. Current source still uses fixed role guards, so a requirement whose business operation exists but whose service grant does not is **PARTIAL**. Source-level routes and scopes are evidence, not approved target entitlements. Shared identity, task state, ledger, audit and cross-cutting controls are specified once in [common-srs.md](common-srs.md); current access evidence is in [rbac-matrix.md](../access/rbac-matrix.md). Priorities are TBD. No deployment behavior was exercised.

## Objectives, interfaces and scope

Current finance interfaces are ledger accounts/transfers, pool requests, fine approval, loans, equity, sprint payouts and CFO dashboard (`src/modules/ledger/ledger.controller.ts:79–257`; `src/modules/payroll/payroll.controller.ts:124–134`; `src/modules/dashboard/dashboard.controller.ts:33–43`). Current CFO has broad finance account visibility; target read/export scope is TBD. CEO passes route guards for some CFO operations; this is not a target grant. Shared ledger invariants are FR-SYS-027–029.

## Other current finance interfaces

| Interface / operation | Source evidence and current access | Target service grant |
|---|---|---|
| Account/entry and transaction read; portfolio | CFO/CEO broad account view; investor portfolio is own (`src/modules/ledger/ledger.controller.ts:79–85`, `:165–185`; `src/modules/equity/equity.controller.ts:34–36`). | Read/export scope **UNVERIFIED**. |
| CFO dashboard and valuation recalculation | CFO dashboard and CFO/CEO recalc route (`src/modules/dashboard/dashboard.controller.ts:33–43`; `src/modules/dashboard/dashboard.service.ts:453–454`). | **UNVERIFIED** target grants. |
| Client/contract creation, escrow funding and board proposal/vote | CFO routes exist (`src/modules/clients/clients.controller.ts:70–101`; `src/modules/governance/governance.controller.ts:50–65`). | **UNVERIFIED** target product and governance grants. |
| Invitations, squad repository administration and sprint setting | Current CFO route access (`src/modules/invitations/invitations.controller.ts:15–44`; `src/modules/squads/squads.controller.ts:125–137`; `src/modules/settings/settings.controller.ts:66–70`). | **UNVERIFIED** target grants. |

## Functional requirements

Each requirement contains one acceptance obligation. The *related permission* is a proposed service/action name for the target policy, not an existing permission record. A requirement marked PARTIAL has the cited business operation in source but no ABAC enforcement. Unspecified grants remain **UNVERIFIED** and are denied by the target default policy.

### FR-CFO-001 — Allocate squad funds

| Field | Requirement detail |
|---|---|
| ID | `FR-CFO-001` |
| Name | Allocate squad funds |
| Description | Move reserve funds to a squad treasury. |
| Actor | Finance operator |
| Preconditions | Valid accounts, positive amount and ledger.allocate grant. |
| Trigger | Submit allocation. |
| System behavior | The system shall post a balanced reserve-to-squad transfer using the supplied amount and idempotency key. |
| Postconditions | Ledger balances updated. |
| Exceptions | Invalid amount, insufficient reserve, frozen account or duplicate mismatch: reject. |
| Related permission | `ledger.allocate`; target grant/scope policy. |
| Implementation status | **PARTIAL — CFO operation exists, grant absent.** |
| Evidence | `src/modules/ledger/ledger.controller.ts:92–112`; `src/modules/ledger/ledger.service.ts:55–183`. |

### FR-CFO-002 — Allocate personal funds

| Field | Requirement detail |
|---|---|
| ID | `FR-CFO-002` |
| Name | Allocate personal funds |
| Description | Transfer funds to a personal wallet. |
| Actor | Finance operator |
| Preconditions | Valid recipient, available reserve and ledger.allocatePersonal grant. |
| Trigger | Submit allocation. |
| System behavior | The system shall post the authorized personal allocation with ledger entries. |
| Postconditions | Recipient wallet and ledger updated. |
| Exceptions | Unknown recipient, insufficient funds, frozen account or no grant: reject. |
| Related permission | `ledger.allocatePersonal`; target grant/scope policy. |
| Implementation status | **PARTIAL — CFO operation exists, grant absent.** |
| Evidence | `src/modules/ledger/ledger.controller.ts:114–136`; `src/modules/ledger/ledger.service.ts:55–183`. |

### FR-CFO-003 — Return squad funds

| Field | Requirement detail |
|---|---|
| ID | `FR-CFO-003` |
| Name | Return squad funds |
| Description | Move available squad treasury funds to reserve. |
| Actor | Finance operator |
| Preconditions | Squad treasury and ledger.returnFunds grant. |
| Trigger | Submit return. |
| System behavior | The system shall post a balanced squad-to-reserve transfer. |
| Postconditions | Treasury/reserve balances updated. |
| Exceptions | Insufficient treasury, frozen account or no grant: reject. |
| Related permission | `ledger.returnFunds`; target grant/scope policy. |
| Implementation status | **PARTIAL — CFO operation exists, grant absent.** |
| Evidence | `src/modules/ledger/ledger.controller.ts:138–154`; `src/modules/ledger/ledger.service.ts:55–183`. |

### FR-CFO-004 — Request pool funding

| Field | Requirement detail |
|---|---|
| ID | `FR-CFO-004` |
| Name | Request pool funding |
| Description | Submit a reserve-to-pool funding request for CEO decision. |
| Actor | Finance requester |
| Preconditions | Positive amount and poolFunding.request grant. |
| Trigger | Submit request and memo. |
| System behavior | The system shall create a pending request with requester identity and audit record. |
| Postconditions | CEO decision is pending. |
| Exceptions | Invalid amount or no grant: reject. |
| Related permission | `poolFunding.request`; target grant/scope policy. |
| Implementation status | **PARTIAL — CFO path exists, grant absent.** |
| Evidence | `src/modules/ledger/ledger.controller.ts:189–209`; WF-09. |

### FR-CFO-005 — Approve fine proposal

| Field | Requirement detail |
|---|---|
| ID | `FR-CFO-005` |
| Name | Approve fine proposal |
| Description | Approve a pending proposed fine. |
| Actor | Fine approver |
| Preconditions | Proposal pending and fines.approve grant. |
| Trigger | Submit approval. |
| System behavior | The system shall record approval and post the implemented fine transfer. |
| Postconditions | Fine proposal approved and ledger updated. |
| Exceptions | Wrong state, invalid proposal, insufficient source funds or no grant: reject. |
| Related permission | `fines.approve`; target grant/scope policy. |
| Implementation status | **PARTIAL — service enforces CFO today; service grant absent.** |
| Evidence | `src/modules/payroll/payroll.controller.ts:124–134`; `src/modules/payroll/payroll.service.ts:31–112`. |

### FR-CFO-006 — Submit sprint payout

| Field | Requirement detail |
|---|---|
| ID | `FR-CFO-006` |
| Name | Submit sprint payout |
| Description | Create a ranked sprint payout proposal. |
| Actor | Payout preparer |
| Preconditions | Eligible sprint and sprintPayouts.submit grant. |
| Trigger | Submit payout. |
| System behavior | The system shall validate a submitted contiguous ranking of every active squad and store one payout item per squad for CEO decision. |
| Postconditions | Proposal awaits CEO approval. |
| Exceptions | Duplicate sprint, missing inputs or no grant: reject. |
| Related permission | `sprintPayouts.submit`; target grant/scope policy. |
| Implementation status | **PARTIAL — CFO operation exists, grant absent.** |
| Evidence | `src/modules/sprint-payouts/sprint-payouts.controller.ts:37–46`; `src/modules/sprint-payouts/sprint-payouts.service.ts:24–75`; WF-06. |

### FR-CFO-007 — Execute approved sprint payout

| Field | Requirement detail |
|---|---|
| ID | `FR-CFO-007` |
| Name | Execute approved sprint payout |
| Description | Post an approved payout batch. |
| Actor | Payout executor |
| Preconditions | CEO approval recorded; sprintPayouts.execute grant. |
| Trigger | Request execution. |
| System behavior | The system shall post each authorized payout and mark the proposal executed after successful processing. |
| Postconditions | Payout ledger and status updated. |
| Exceptions | Missing approval, insufficient funds, failed posting or no grant: reject/report; all-batch rollback is not implemented. |
| Related permission | `sprintPayouts.execute`; target grant/scope policy. |
| Implementation status | **PARTIAL — CFO execution exists, service grant absent; all-batch atomicity PROPOSED in FR-SYS-021.** |
| Evidence | `src/modules/sprint-payouts/sprint-payouts.controller.ts:53–58`; `src/modules/sprint-payouts/sprint-payouts.service.ts:108–190`; WF-06. |

### FR-CFO-008 — Disburse approved loan

| Field | Requirement detail |
|---|---|
| ID | `FR-CFO-008` |
| Name | Disburse approved loan |
| Description | Fund an emergency squad loan after CEO gate. |
| Actor | Loan disburser |
| Preconditions | Loan is active, not disbursed and CEO-approved; loans.disburse grant. |
| Trigger | Request disbursement. |
| System behavior | The system shall post reserve-to-treasury transfer and record disbursement/due date. |
| Postconditions | Loan has disbursement record. |
| Exceptions | No CEO gate, insufficient reserve, wrong state or no grant: reject. |
| Related permission | `loans.disburse`; target grant/scope policy. |
| Implementation status | **PARTIAL — CFO route exists, grant absent.** |
| Evidence | `src/modules/loans/loans.controller.ts:33–38`; `src/modules/loans/loans.service.ts:89–145`; WF-07. |

### FR-CFO-009 — Invest in squad equity

| Field | Requirement detail |
|---|---|
| ID | `FR-CFO-009` |
| Name | Invest in squad equity |
| Description | Use permitted finance funds for a squad stake. |
| Actor | Investor |
| Preconditions | Eligible squad/sprint and equity.invest grant. |
| Trigger | Submit investment. |
| System behavior | The system shall apply the implemented stake cap and ledger transfer before recording the stake. |
| Postconditions | Investment and ledger entries recorded. |
| Exceptions | Cap, duplicate stake, balance or no grant: reject; post-ledger record failure recovery TBD. |
| Related permission | `equity.invest`; target grant/scope policy. |
| Implementation status | **PARTIAL — CFO route exists, grant absent.** |
| Evidence | `src/modules/equity/equity.controller.ts:28–36`; `src/modules/equity/equity.service.ts:19–75`. |


## Workflow, data and dependencies

WF-06: CFO prepares payout, CEO approves, CFO executes. WF-07: PM requests loan, board/CEO decide, CFO disburses. WF-09: CFO requests funding, CEO decides. Inputs are amounts, recipient/squad IDs, memos and approval records; outputs are ledger entries, request/proposal states and balances.

## Errors, audit and unresolved decisions

Financial actions require actor, grant, resource, amount, ledger transaction and idempotency evidence; common ledger and audit requirements apply. Current payout execution may partially post per squad (`src/modules/sprint-payouts/sprint-payouts.service.ts:108–190`). Decide CEO override, maker/checker constraints, target portfolio and account read scopes, export authority, and recovery for ledger-success/record-failure paths. Payroll payment executor remains **UNVERIFIED**; CFO does not gain that authority from this document.
