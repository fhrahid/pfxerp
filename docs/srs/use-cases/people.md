# People use case descriptions

**Draft, 2026-11-07.** Actor associations describe current RBAC where stated; target service/action grants are separate and mostly not implemented. A listed supporting actor is a collaborator or decision maker, never an automatic permission grant. Source references are in each case.

## UC-CHRO-001 — Review submitted payroll
- **ID:** `UC-CHRO-001`
- **Name:** Review submitted payroll
- **Goal:** A payroll decision must be based on a submitted proposal and its line items.
- **Actors:** Primary: CHRO. Supporting: None identified for this operation.
- **Trigger:** Grantee opens the payroll review queue.
- **Preconditions:** An authenticated grantee and a submitted proposal exist.
- **Main flow:** 1. Grantee opens the payroll review queue. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall present the proposal, squad, lab, sprint, recipient, tier, amount and justification to a grantee whose payroll.read scope covers that proposal. 4. Proposal is unchanged; decision evidence is available.
- **Alternative flow:** Filter the queue by permitted status or squad when such scope is approved; no organization-wide CHRO view is established.
- **Exceptions:** Missing proposal, denied scope or malformed status: reject access or query; do not infer organization-wide visibility.
- **Postconditions:** Proposal is unchanged; decision evidence is available.
- **Business rules:** BR-012–BR-015 apply to the submitted proposal; CHRO read scope is TBD.
- **Related requirement IDs:** `FR-CHRO-001`
- **Implementation status:** PROPOSED — review access is needed for the planned approval, but queue scope is not decided and no CHRO route exists.
- **Permission/evidence:** `payroll.read`; target grant/scope policy. Evidence: `docs/srs/DECISIONS.md:7–9`; `src/modules/payroll/payroll.service.ts:183–199`; `src/modules/payroll/payroll.controller.ts:93–103`.

## UC-CHRO-002 — Approve payroll proposal
- **ID:** `UC-CHRO-002`
- **Name:** Approve payroll proposal
- **Goal:** The owner assigns payroll approval to CHRO; approval authority is a distinct service operation.
- **Actors:** Primary: CHRO. Supporting: PM
- **Trigger:** Grantee submits an approval decision.
- **Preconditions:** Proposal is SUBMITTED; grantee holds payroll.approve for the proposal scope.
- **Main flow:** 1. Grantee submits an approval decision. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record the approving principal, proposal and decision only after checking the payroll.approve grant and applicable state and scope. 4. Approval decision is retained; payment execution follows a separately authorized step.
- **Alternative flow:** A rejection path is not assigned to CHRO; the decision is held for business-policy resolution.
- **Exceptions:** Missing grant, wrong state, self-approval policy or failed recording: reject without treating payroll as approved. Whether self-approval is prohibited remains UNVERIFIED.
- **Postconditions:** Approval decision is retained; payment execution follows a separately authorized step.
- **Business rules:** BR-014; CHRO approval authority is owner-planned, while payment execution is unresolved.
- **Related requirement IDs:** `FR-CHRO-002`
- **Implementation status:** PLANNED — owner policy; no CHRO enum/route or separated approval exists.
- **Permission/evidence:** `payroll.approve`; target grant/scope policy. Evidence: `docs/srs/access/HANDOFF.md`; `src/modules/payroll/payroll.controller.ts:98–109`; `src/modules/payroll/payroll.service.ts:200–317`.


## UC-PM-005 — Submit squad payroll
- **ID:** `UC-PM-005`
- **Name:** Submit squad payroll
- **Goal:** Propose payroll for active squad members.
- **Actors:** Primary: PM. Supporting: CHRO (target approval)
- **Trigger:** Submit proposal.
- **Preconditions:** Active PM membership, line items valid, payroll.submit grant.
- **Main flow:** 1. Submit proposal. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall reject duplicate recipients, nonmembers, tier-cap and budget violations before storing the proposal. 4. Proposal is SUBMITTED for CHRO decision.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Existing lab proposal, invalid amount or no grant: reject.
- **Postconditions:** Proposal is SUBMITTED for CHRO decision.
- **Business rules:** BR-012–BR-015; one proposal per squad/lab and active recipients.
- **Related requirement IDs:** `FR-PM-005`
- **Implementation status:** PARTIAL — PM operation exists, grant absent; target CHRO handoff planned.
- **Permission/evidence:** `payroll.submit`; target grant/scope policy. Evidence: `src/modules/payroll/payroll.controller.ts:89–93`; `src/modules/payroll/payroll.service.ts:125–181`; WF-05.

## UC-SYS-007 — Execute approved payroll
- **ID:** `UC-SYS-007`
- **Name:** Execute approved payroll
- **Goal:** Disburse an approved payroll proposal
- **Actors:** Primary: Payment executor (target TBD). Supporting: PM submits proposal; CHRO is planned approver; current CPO/CEO combines approval and payment.
- **Trigger:** Executor requests payment after approval.
- **Preconditions:** Proposal approved under target policy; executor service grant TBD.
- **Main flow:** 1. Executor requests payment after approval. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall post a balanced treasury-to-wallet payroll batch. 4. Payment ledger and proposal status updated.
- **Alternative flow:** Current CPO/CEO approval combines decision and payment in one operation; the target executor remains undecided.
- **Exceptions:** Missing authorization, invalid recipient, inadequate funds or posting failure: deny/abort.
- **Postconditions:** Payment ledger and proposal status updated.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-018`, `FR-CHRO-003`
- **Implementation status:** PARTIAL — current combined CPO/CEO payment path exists; separate target executor and service grant do not.
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/payroll/payroll.controller.ts:98–109`; `src/modules/payroll/payroll.service.ts:200–317`.

## UC-SYS-025 — Create fine proposal
- **ID:** `UC-SYS-025`
- **Name:** Create fine proposal
- **Goal:** Request financial penalty review
- **Actors:** Primary: Current CTO/CPO/CEO. Supporting: None required by this use case.
- **Trigger:** Actor submits fine proposal.
- **Preconditions:** Current route role and valid proposal.
- **Main flow:** 1. Actor submits fine proposal. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record a pending fine proposal for CFO decision. 4. Proposal awaits approval.
- **Alternative flow:** CFO approval follows UC-CFO-005; CEO cannot approve through service role check.
- **Exceptions:** Invalid target/amount or no current role: reject.
- **Postconditions:** Proposal awaits approval.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/payroll/payroll.controller.ts:120–134`; `src/modules/payroll/payroll.service.ts:31–112`.

## UC-SYS-026 — Reject payroll proposal
- **ID:** `UC-SYS-026`
- **Name:** Reject payroll proposal
- **Goal:** Return a payroll proposal
- **Actors:** Primary: Current CPO/CEO. Supporting: None required by this use case.
- **Trigger:** Actor supplies rejection reason.
- **Preconditions:** Proposal pending; current CPO route, CEO bypass.
- **Main flow:** 1. Actor supplies rejection reason. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record rejection and reason without disbursement. 4. Proposal rejected.
- **Alternative flow:** Target CHRO rejection authority is UNVERIFIED.
- **Exceptions:** Wrong state or no current authorization: reject; current service does not validate reason content.
- **Postconditions:** Proposal rejected.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/payroll/payroll.controller.ts:105–110`; `src/modules/payroll/payroll.service.ts:318–327`.
