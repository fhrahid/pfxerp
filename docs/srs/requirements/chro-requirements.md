# CHRO perspective requirements

**Draft, 2026-11-07.** This perspective uses attribute-based access control (ABAC): an operation requires an explicit service/action grant and resource-scope predicates. Job titles describe responsibilities and do not themselves grant access. Current source still uses fixed role guards, so a requirement whose business operation exists but whose service grant does not is **PARTIAL**. Source-level routes and scopes are evidence, not approved target entitlements. Shared identity, task state, ledger, audit and cross-cutting controls are specified once in [common-srs.md](common-srs.md); current access evidence is in [rbac-matrix.md](../access/rbac-matrix.md). Priorities are TBD. No deployment behavior was exercised.

## Objectives, interfaces and scope

CHRO is a distinct **PLANNED** people perspective. The only owner-confirmed authority is payroll approval. Current code combines people/product functions under CPO and has no CHRO guard or role (`prisma/schema.prisma:14–21`; `src/modules/roles/roles.service.ts:9–20`). The proposed CHRO interface is the payroll review/decision service; access to users, squads, fines, notices and payment execution is **UNVERIFIED**, not implied by the title. Target visibility is restricted to explicitly granted payroll scope; the scope value itself is TBD. See WF-05 and FR-SYS-017/018.

## Current interface coverage and target grants

| Interface | Current source behavior | Target status |
|---|---|---|
| `GET /api/v1/payroll`, `POST /api/v1/payroll/:id/approve` | CPO/CEO can view across squads and approval also disburses; CHRO has no route (`src/modules/payroll/payroll.controller.ts:95–110`; `src/modules/payroll/payroll.service.ts:183–317`). | CHRO approval **PLANNED**; view scope and separate executor **UNVERIFIED**. |
| Users, squad membership, fines, notices | Current CPO combines these people/product operations (`src/modules/users/users.controller.ts:91–136`; `src/modules/squads/squads.controller.ts:91–175`; `src/modules/payroll/payroll.controller.ts:114–134`; `src/modules/notices/notices.controller.ts:75–190`). | CHRO grants **UNVERIFIED**; no transfer inferred. |

## Functional requirements

Each requirement contains one acceptance obligation. The *related permission* is a proposed service/action name for the target policy, not an existing permission record. A requirement marked PARTIAL has the cited business operation in source but no ABAC enforcement. Unspecified grants remain **UNVERIFIED** and are denied by the target default policy.

### FR-CHRO-001 — Review submitted payroll

| Field | Requirement detail |
|---|---|
| ID | `FR-CHRO-001` |
| Name | Review submitted payroll |
| Description | A payroll decision must be based on a submitted proposal and its line items. |
| Actor | CHRO service grantee |
| Preconditions | An authenticated grantee and a submitted proposal exist. |
| Trigger | Grantee opens the payroll review queue. |
| System behavior | The system shall present the proposal, squad, lab, sprint, recipient, tier, amount and justification to a grantee whose payroll.read scope covers that proposal. |
| Postconditions | Proposal is unchanged; decision evidence is available. |
| Exceptions | Missing proposal, denied scope or malformed status: reject access or query; do not infer organization-wide visibility. |
| Related permission | `payroll.read`; target grant/scope policy. |
| Implementation status | **PROPOSED — review access is needed for the planned approval, but queue scope is not decided and no CHRO route exists.** |
| Evidence | `docs/srs/DECISIONS.md:7–9`; `src/modules/payroll/payroll.service.ts:183–199`; `src/modules/payroll/payroll.controller.ts:93–103`. |

### FR-CHRO-002 — Approve payroll proposal

| Field | Requirement detail |
|---|---|
| ID | `FR-CHRO-002` |
| Name | Approve payroll proposal |
| Description | The owner assigns payroll approval to CHRO; approval authority is a distinct service operation. |
| Actor | CHRO service grantee |
| Preconditions | Proposal is SUBMITTED; grantee holds payroll.approve for the proposal scope. |
| Trigger | Grantee submits an approval decision. |
| System behavior | The system shall record the approving principal, proposal and decision only after checking the payroll.approve grant and applicable state and scope. |
| Postconditions | Approval decision is retained; payment execution follows a separately authorized step. |
| Exceptions | Missing grant, wrong state, self-approval policy or failed recording: reject without treating payroll as approved. Whether self-approval is prohibited remains UNVERIFIED. |
| Related permission | `payroll.approve`; target grant/scope policy. |
| Implementation status | **PLANNED — owner policy; no CHRO enum/route or separated approval exists.** |
| Evidence | `docs/srs/access/HANDOFF.md`; `src/modules/payroll/payroll.controller.ts:98–109`; `src/modules/payroll/payroll.service.ts:200–317`. |

### FR-CHRO-003 — Preserve approval/payment separation

| Field | Requirement detail |
|---|---|
| ID | `FR-CHRO-003` |
| Name | Preserve approval/payment separation |
| Description | Payroll payment execution must not follow solely from a CHRO job title. |
| Actor | Payroll service |
| Preconditions | An approval decision exists; payment authority remains to be specified. |
| Trigger | A payment execution is requested. |
| System behavior | The system shall evaluate a distinct payroll.execute service grant and proposal state before posting ledger entries. |
| Postconditions | Only a separately authorized executor can initiate payment. |
| Exceptions | Missing grant or unapproved proposal: deny without ledger posting. Executor identity and CEO override policy are UNVERIFIED. |
| Related permission | `payroll.execute`; target grant/scope policy. |
| Implementation status | **PROPOSED — necessary boundary for service access; executor policy undecided.** |
| Evidence | `docs/srs/access/HANDOFF.md`; `src/modules/payroll/payroll.service.ts:200–317`; `docs/srs/DECISIONS.md:8`. |


## Workflow, data and dependencies

WF-05: PM submits validated line items; CHRO reviews and approves under the owner decision; the payment executor, rejection actor and timing remain open. Inputs are proposal and line items; output is a decision record. Current code combines CPO approval and disbursement, so the target handoff requires separation (`src/modules/payroll/payroll.service.ts:125–181`, `:200–327`).

## Errors, audit and unresolved decisions

The current submit path rejects duplicate recipients, nonmembers, over-budget totals and tier caps (`src/modules/payroll/payroll.service.ts:125–181`). CHRO target error responses and audit retention are **UNVERIFIED** beyond the shared audit policy. Decide payroll queue scope, rejector, payment executor, CEO exception, self-approval rule and transfer of other people actions. Do not grant CHRO CPO functions from current route names.
