# Clients use case descriptions

**Draft, 2026-11-07.** Actor associations describe current RBAC where stated; target service/action grants are separate and mostly not implemented. A listed supporting actor is a collaborator or decision maker, never an automatic permission grant. Source references are in each case.

## UC-CTO-007 — Audit client milestone
- **ID:** `UC-CTO-007`
- **Name:** Audit client milestone
- **Goal:** Record technical pass/fail before internal acceptance.
- **Actors:** Primary: CTO. Supporting: Assigned squad PM
- **Trigger:** Submit audit result.
- **Preconditions:** Milestone IN_PROGRESS or CTO_AUDIT; clients.audit grant.
- **Main flow:** 1. Submit audit result. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record pass/fail and move the milestone to CLIENT_REVIEW on pass or IN_PROGRESS on failure. 4. Technical review state updated.
- **Alternative flow:** A failed audit returns the milestone to IN_PROGRESS; a pass moves it to CLIENT_REVIEW.
- **Exceptions:** Wrong state, missing milestone or no grant: reject.
- **Postconditions:** Technical review state updated.
- **Business rules:** BR-020; pass precedes internal acceptance.
- **Related requirement IDs:** `FR-CTO-007`
- **Implementation status:** PARTIAL — CTO route exists, service grant absent.
- **Permission/evidence:** `clients.audit`; target grant/scope policy. Evidence: `src/modules/clients/clients.controller.ts:108–113`; `src/modules/clients/clients.service.ts:131–149`; WF-08.

## UC-PM-010 — Record internal milestone acceptance
- **ID:** `UC-PM-010`
- **Name:** Record internal milestone acceptance
- **Goal:** Attest a milestone for an assigned squad after technical pass.
- **Actors:** Primary: PM. Supporting: Technical auditor
- **Trigger:** Submit acceptance.
- **Preconditions:** Assigned squad, CTO pass, clients.acceptInternal grant.
- **Main flow:** 1. Submit acceptance. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record the internal acceptance and release escrow only when shared milestone conditions hold. 4. Milestone paid or disputed.
- **Alternative flow:** Negative internal acceptance moves the contract into dispute; this is not client-authenticated approval.
- **Exceptions:** Other squad, no technical pass, insufficient escrow or no grant: reject.
- **Postconditions:** Milestone paid or disputed.
- **Business rules:** BR-020, FR-SYS-026; acceptance is internal.
- **Related requirement IDs:** `FR-PM-010`
- **Implementation status:** PARTIAL — internal PM path exists, grant absent; external client approval absent.
- **Permission/evidence:** `clients.acceptInternal`; target grant/scope policy. Evidence: `src/modules/clients/clients.controller.ts:116–119`; `src/modules/clients/clients.service.ts:151–231`; WF-08.

## UC-SYS-016 — Manage client contract and milestone
- **ID:** `UC-SYS-016`
- **Name:** Manage client contract and milestone
- **Goal:** Set up client work and escrow through actor-specific steps.
- **Actors:** Current CEO/CPO/CFO may create clients/contracts, add milestones and fund escrow. Current PM may add milestones but cannot create clients/contracts or fund escrow. Current CEO/CPO/CTO/PM may assign a milestone; CTO audit and internal acceptance are separate cases. These are source associations, not target grants.
- **Trigger:** An authorized internal actor starts one of the setup steps.
- **Preconditions:** A contract exists before adding a milestone; a milestone exists before funding or assignment. Current route roles differ by step; target grants and scopes are UNVERIFIED.
- **Main flow:** 1. CEO/CPO/CFO creates the client and contract where needed. 2. A permitted actor adds the milestone to an existing contract. 3. CEO/CPO/CFO funds its escrow. 4. A permitted actor assigns a squad. Each step uses its own current route check; target ABAC evaluates its own action and resource scope. The resulting milestone is available for technical audit.
- **Alternative flow:** PM can add and assign a milestone without gaining client/contract creation or funding authority. The current assignment route does not pass the caller to its service, so PM squad-scope enforcement is not evidenced there.
- **Exceptions:** Invalid shares, insufficient reserve, missing squad or wrong state: reject.
- **Postconditions:** Completed setup steps are recorded; a funded, assigned milestone can progress toward technical audit and internal acceptance.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-025`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC differs for client/contract creation, milestone addition, escrow funding and assignment; target grants for each are UNVERIFIED. Evidence: `src/modules/clients/clients.controller.ts:70–107`; `src/modules/clients/clients.service.ts:24–129`.
