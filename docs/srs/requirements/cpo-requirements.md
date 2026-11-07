# CPO perspective requirements and decision boundary

**Draft, 2026-11-07.** CPO is a distinct target job-role label under DEC-02. This document records the current combined CPO source behavior and the unresolved target split. The target ABAC policy requires an active CEO-managed direct service/action grant plus resource, state and context checks; the CPO label alone supplies no grant. No target CPO-specific functional requirement ID is allocated until its operations and scopes are approved. Shared obligations remain in [common-srs.md](common-srs.md).

## Current interface evidence

| Current source action | Current evidence | Target authority |
|---|---|---|
| Manage non-executive worker accounts and squad membership | `src/modules/users/users.controller.ts:91–137`; `src/modules/squads/squads.controller.ts:87–175` | **UNVERIFIED** whether CPO retains these or CHRO receives them. CEO job-label administration is separately PLANNED in DEC-02. |
| Approve or reject payroll proposals | `src/modules/payroll/payroll.controller.ts:98–128`; approval also disburses in `src/modules/payroll/payroll.service.ts:200–317` | CHRO payroll approval is **PLANNED**. CPO rejection and payment execution authority are **UNVERIFIED**; no CPO grant follows from current routes. |
| Dispatch notices and create products | `src/modules/notices/notices.controller.ts:116–128`; `src/modules/telemetry/telemetry.controller.ts:51–59` | **UNVERIFIED** sender, product-management and resource scopes. Notice-envelope target is shared FR-SYS-034/NFR-016. |
| Create clients/contracts and fund escrow; participate in internal milestone acceptance | `src/modules/clients/clients.controller.ts:70–119` | **UNVERIFIED** which client/finance actions CPO retains. Internal acceptance is not external client attestation. |
| Propose or vote on board decisions | `src/modules/governance/governance.controller.ts:50–65` | **UNVERIFIED** future action grants and conflict policy; the CEO final-decision step is separate. |

## Target requirements boundary

The current role matrix is [source evidence](../access/rbac-matrix.md), not a CPO target permission list. A future CPO-specific requirement must name one action, resource scope, state condition and evidence status, then link to the shared ABAC rule (FR-SYS-008), visibility rule (FR-SYS-035) and relevant workflow. Until the CHRO/CPO transfer is decided, target CPO actions above are **UNVERIFIED** and the deny-by-default target policy grants none by implication. The target CPO diagram [cpo-perspective.puml](../diagrams/use-cases/cpo-perspective.puml) labels only current source actions.

**Open decision:** which worker, squad, notice, product, client, governance, fine and payroll-rejection operations are assigned to CPO; their read/export scopes; and any maker/checker constraints. CHRO payroll approval itself is recorded in [chro-requirements.md](chro-requirements.md).
