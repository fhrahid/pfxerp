# Finance use case descriptions

**Draft, 2026-11-07.** Actor associations describe current RBAC where stated; target service/action grants are separate and mostly not implemented. A listed supporting actor is a collaborator or decision maker, never an automatic permission grant. Source references are in each case.

## UC-CFO-001 — Allocate squad funds
- **ID:** `UC-CFO-001`
- **Name:** Allocate squad funds
- **Goal:** Move reserve funds to a squad treasury.
- **Actors:** Primary: CFO. Supporting: None identified for this operation.
- **Trigger:** Submit allocation.
- **Preconditions:** Valid accounts, positive amount and ledger.allocate grant.
- **Main flow:** 1. Submit allocation. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall post a balanced reserve-to-squad transfer using the supplied amount and idempotency key. 4. Ledger balances updated.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Invalid amount, insufficient reserve, frozen account or duplicate mismatch: reject.
- **Postconditions:** Ledger balances updated.
- **Business rules:** BR-021, FR-SYS-028, FR-SYS-029.
- **Related requirement IDs:** `FR-CFO-001`
- **Implementation status:** PARTIAL — CFO operation exists, grant absent.
- **Permission/evidence:** `ledger.allocate`; target grant/scope policy. Evidence: `src/modules/ledger/ledger.controller.ts:92–112`; `src/modules/ledger/ledger.service.ts:55–183`.

## UC-CFO-002 — Allocate personal funds
- **ID:** `UC-CFO-002`
- **Name:** Allocate personal funds
- **Goal:** Transfer funds to a personal wallet.
- **Actors:** Primary: CFO. Supporting: None identified for this operation.
- **Trigger:** Submit allocation.
- **Preconditions:** Valid recipient, available reserve and ledger.allocatePersonal grant.
- **Main flow:** 1. Submit allocation. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall post the authorized personal allocation with ledger entries. 4. Recipient wallet and ledger updated.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Unknown recipient, insufficient funds, frozen account or no grant: reject.
- **Postconditions:** Recipient wallet and ledger updated.
- **Business rules:** BR-021, FR-SYS-028, FR-SYS-029.
- **Related requirement IDs:** `FR-CFO-002`
- **Implementation status:** PARTIAL — CFO operation exists, grant absent.
- **Permission/evidence:** `ledger.allocatePersonal`; target grant/scope policy. Evidence: `src/modules/ledger/ledger.controller.ts:114–136`; `src/modules/ledger/ledger.service.ts:55–183`.

## UC-CFO-003 — Return squad funds
- **ID:** `UC-CFO-003`
- **Name:** Return squad funds
- **Goal:** Move available squad treasury funds to reserve.
- **Actors:** Primary: CFO. Supporting: None identified for this operation.
- **Trigger:** Submit return.
- **Preconditions:** Squad treasury and ledger.returnFunds grant.
- **Main flow:** 1. Submit return. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall post a balanced squad-to-reserve transfer. 4. Treasury/reserve balances updated.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Insufficient treasury, frozen account or no grant: reject.
- **Postconditions:** Treasury/reserve balances updated.
- **Business rules:** BR-021, FR-SYS-028, FR-SYS-029.
- **Related requirement IDs:** `FR-CFO-003`
- **Implementation status:** PARTIAL — CFO operation exists, grant absent.
- **Permission/evidence:** `ledger.returnFunds`; target grant/scope policy. Evidence: `src/modules/ledger/ledger.controller.ts:138–154`; `src/modules/ledger/ledger.service.ts:55–183`.

## UC-CFO-004 — Request pool funding
- **ID:** `UC-CFO-004`
- **Name:** Request pool funding
- **Goal:** Submit a reserve-to-pool funding request for CEO decision.
- **Actors:** Primary: CFO. Supporting: CEO
- **Trigger:** Submit request and memo.
- **Preconditions:** Positive amount and poolFunding.request grant.
- **Main flow:** 1. Submit request and memo. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall create a pending request with requester identity and audit record. 4. CEO decision is pending.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Invalid amount or no grant: reject.
- **Postconditions:** CEO decision is pending.
- **Business rules:** BR-019 prohibits requester self-approval.
- **Related requirement IDs:** `FR-CFO-004`
- **Implementation status:** PARTIAL — CFO path exists, grant absent.
- **Permission/evidence:** `poolFunding.request`; target grant/scope policy. Evidence: `src/modules/ledger/ledger.controller.ts:189–209`; WF-09.

## UC-CFO-005 — Approve fine proposal
- **ID:** `UC-CFO-005`
- **Name:** Approve fine proposal
- **Goal:** Approve a pending proposed fine.
- **Actors:** Primary: CFO. Supporting: None identified for this operation.
- **Trigger:** Submit approval.
- **Preconditions:** Proposal pending and fines.approve grant.
- **Main flow:** 1. Submit approval. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record approval and post the implemented fine transfer. 4. Fine proposal approved and ledger updated.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Wrong state, invalid proposal, insufficient source funds or no grant: reject.
- **Postconditions:** Fine proposal approved and ledger updated.
- **Business rules:** Fine proposal must be pending and the source service requires CFO.
- **Related requirement IDs:** `FR-CFO-005`
- **Implementation status:** PARTIAL — service enforces CFO today; service grant absent.
- **Permission/evidence:** `fines.approve`; target grant/scope policy. Evidence: `src/modules/payroll/payroll.controller.ts:124–134`; `src/modules/payroll/payroll.service.ts:31–112`.

## UC-CFO-006 — Submit sprint payout
- **ID:** `UC-CFO-006`
- **Name:** Submit sprint payout
- **Goal:** Create a ranked sprint payout proposal.
- **Actors:** Primary: CFO. Supporting: CEO
- **Trigger:** Submit payout.
- **Preconditions:** Eligible sprint and sprintPayouts.submit grant.
- **Main flow:** 1. Submit payout. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate a submitted contiguous ranking of every active squad and store one payout item per squad for CEO decision. 4. Proposal awaits CEO approval.
- **Alternative flow:** A duplicate or incomplete ranking is returned for correction without creating a payout.
- **Exceptions:** Duplicate sprint, missing inputs or no grant: reject.
- **Postconditions:** Proposal awaits CEO approval.
- **Business rules:** BR-016 requires all active squads, ranked 1..N.
- **Related requirement IDs:** `FR-CFO-006`
- **Implementation status:** PARTIAL — CFO operation exists, grant absent.
- **Permission/evidence:** `sprintPayouts.submit`; target grant/scope policy. Evidence: `src/modules/sprint-payouts/sprint-payouts.controller.ts:37–46`; `src/modules/sprint-payouts/sprint-payouts.service.ts:24–75`; WF-06.

## UC-CFO-007 — Execute approved sprint payout
- **ID:** `UC-CFO-007`
- **Name:** Execute approved sprint payout
- **Goal:** Post an approved payout batch.
- **Actors:** Primary: CFO. Supporting: CEO and squad PM
- **Trigger:** Request execution.
- **Preconditions:** CEO approval recorded; sprintPayouts.execute grant.
- **Main flow:** 1. Request execution. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall post each authorized payout and mark the proposal executed after successful processing. 4. Payout ledger and status updated.
- **Alternative flow:** If one squad posting fails, current source can leave earlier squads posted; all-batch atomicity is PROPOSED.
- **Exceptions:** Missing approval, insufficient funds, failed posting or no grant: reject/report; all-batch rollback is not implemented.
- **Postconditions:** Payout ledger and status updated.
- **Business rules:** BR-017; BR-022 all-batch atomicity is PROPOSED.
- **Related requirement IDs:** `FR-CFO-007`
- **Implementation status:** PARTIAL — CFO execution exists, service grant absent; all-batch atomicity PROPOSED in FR-SYS-021.
- **Permission/evidence:** `sprintPayouts.execute`; target grant/scope policy. Evidence: `src/modules/sprint-payouts/sprint-payouts.controller.ts:53–58`; `src/modules/sprint-payouts/sprint-payouts.service.ts:108–190`; WF-06.

## UC-CFO-008 — Disburse approved loan
- **ID:** `UC-CFO-008`
- **Name:** Disburse approved loan
- **Goal:** Fund an emergency squad loan after CEO gate.
- **Actors:** Primary: CFO. Supporting: CEO, board member and squad PM
- **Trigger:** Request disbursement.
- **Preconditions:** Loan is active, not disbursed and CEO-approved; loans.disburse grant.
- **Main flow:** 1. Request disbursement. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall post reserve-to-treasury transfer and record disbursement/due date. 4. Loan has disbursement record.
- **Alternative flow:** If the loan lacks the CEO gate, it remains undistributed pending governance.
- **Exceptions:** No CEO gate, insufficient reserve, wrong state or no grant: reject.
- **Postconditions:** Loan has disbursement record.
- **Business rules:** FR-SYS-024 requires recorded CEO approval.
- **Related requirement IDs:** `FR-CFO-008`
- **Implementation status:** PARTIAL — CFO route exists, grant absent.
- **Permission/evidence:** `loans.disburse`; target grant/scope policy. Evidence: `src/modules/loans/loans.controller.ts:33–38`; `src/modules/loans/loans.service.ts:89–145`; WF-07.

## UC-CFO-009 — Invest in squad equity
- **ID:** `UC-CFO-009`
- **Name:** Invest in squad equity
- **Goal:** Use permitted finance funds for a squad stake.
- **Actors:** Primary: CFO. Supporting: None identified for this operation.
- **Trigger:** Submit investment.
- **Preconditions:** Eligible squad/sprint and equity.invest grant.
- **Main flow:** 1. Submit investment. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall apply the implemented stake cap and ledger transfer before recording the stake. 4. Investment and ledger entries recorded.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Cap, duplicate stake, balance or no grant: reject; post-ledger record failure recovery TBD.
- **Postconditions:** Investment and ledger entries recorded.
- **Business rules:** At most two active squad stakes per investor per sprint; no duplicate stake in a squad/sprint.
- **Related requirement IDs:** `FR-CFO-009`
- **Implementation status:** PARTIAL — CFO route exists, grant absent.
- **Permission/evidence:** `equity.invest`; target grant/scope policy. Evidence: `src/modules/equity/equity.controller.ts:28–36`; `src/modules/equity/equity.service.ts:19–75`.

## UC-PM-006 — Apply for squad loan
- **ID:** `UC-PM-006`
- **Name:** Apply for squad loan
- **Goal:** Request emergency finance for own squad.
- **Actors:** Primary: PM. Supporting: Board member, CEO and loan disburser
- **Trigger:** Submit loan request.
- **Preconditions:** Active PM membership, eligible treasury, loans.apply grant.
- **Main flow:** 1. Submit loan request. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate threshold and existing-loan conditions and create the loan request. 4. Loan awaits governance and funding.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Other squad, sufficient treasury, active loan or no grant: reject.
- **Postconditions:** Loan awaits governance and funding.
- **Business rules:** Loan eligibility in source; CEO approval gate is FR-SYS-024.
- **Related requirement IDs:** `FR-PM-006`
- **Implementation status:** PARTIAL — PM operation exists, grant absent.
- **Permission/evidence:** `loans.apply`; target grant/scope policy. Evidence: `src/modules/loans/loans.controller.ts:23–27`; `src/modules/loans/loans.service.ts:24–60`; WF-07.

## UC-PM-007 — Repay squad loan
- **ID:** `UC-PM-007`
- **Name:** Repay squad loan
- **Goal:** Return principal and interest from own squad treasury.
- **Actors:** Primary: PM. Supporting: None identified for this operation.
- **Trigger:** Submit repayment.
- **Preconditions:** Disbursed active loan, sufficient treasury, loans.repay grant.
- **Main flow:** 1. Submit repayment. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall post principal and interest and mark loan REPAID. 4. Loan settled.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Other squad, wrong state, insufficient balance or no grant: reject.
- **Postconditions:** Loan settled.
- **Business rules:** Repayment needs disbursed active loan and sufficient treasury.
- **Related requirement IDs:** `FR-PM-007`
- **Implementation status:** PARTIAL — PM operation exists, grant absent.
- **Permission/evidence:** `loans.repay`; target grant/scope policy. Evidence: `src/modules/loans/loans.controller.ts:40–43`; `src/modules/loans/loans.service.ts:147–195`.

## UC-SYS-008 — Approve sprint payout
- **ID:** `UC-SYS-008`
- **Name:** Approve sprint payout
- **Goal:** Authorize CFO payout execution
- **Actors:** Primary: CEO. Supporting: CFO prepares and executes payout.
- **Trigger:** CEO records decision on proposal.
- **Preconditions:** Proposal PROPOSED.
- **Main flow:** 1. CEO records decision on proposal. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record CEO approval and change payout to APPROVED. 4. CFO execution becomes possible.
- **Alternative flow:** CEO may withhold approval; rejection route is not established here.
- **Exceptions:** Missing proposal or wrong state: reject.
- **Postconditions:** CFO execution becomes possible.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-020`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/sprint-payouts/sprint-payouts.controller.ts:49–53`; `src/modules/sprint-payouts/sprint-payouts.service.ts:85–106`.

## UC-SYS-009 — Decide board proposal
- **ID:** `UC-SYS-009`
- **Name:** Decide board proposal
- **Goal:** Record distinct board proposal, vote and CEO final-decision steps.
- **Actors:** Current CFO/CTO/CPO may propose or vote; only the CEO takes the final-decision route. Each action needs its own target grant and state/conflict check.
- **Trigger:** Board member proposes or votes; the CEO separately decides an existing proposal.
- **Preconditions:** Board member has the current board role for proposal/vote; the CEO has the current final-decision route. Target action grants remain UNVERIFIED.
- **Main flow:** 1. CFO/CTO/CPO creates a proposal. 2. A different eligible board member votes at most once while it remains PROPOSED. 3. The CEO may make a separate final decision on a nonfinal proposal. 4. The system retains each actor and state. The CEO route does not give board members final-decision authority.
- **Alternative flow:** CEO currently can decide before two votes; whether intended is UNVERIFIED.
- **Exceptions:** Proposer self-vote or duplicate vote: reject.
- **Postconditions:** Decision state retained.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-023`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current board proposal/vote and CEO final-decision routes are distinct; target grants are UNVERIFIED. Evidence: `src/modules/governance/governance.controller.ts:50–71`; `src/modules/governance/governance.service.ts:20–130`.

## UC-SYS-010 — View accounts and entries
- **ID:** `UC-SYS-010`
- **Name:** View accounts and entries
- **Goal:** Inspect permitted balances and ledger entries
- **Actors:** Primary: Authorized account viewer. Supporting: None required by this use case.
- **Trigger:** Viewer opens account or entries.
- **Preconditions:** Authenticated; current CFO/CEO broad, PM squad+own, others own.
- **Main flow:** 1. Viewer opens account or entries. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall return only accounts visible under the caller’s accounting scope and entries for a visible account. 4. No ledger mutation.
- **Alternative flow:** Viewer may filter recent transactions where current role permits; export is UNVERIFIED.
- **Exceptions:** Inaccessible account: deny.
- **Postconditions:** No ledger mutation.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-027`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/ledger/ledger.controller.ts:79–85`, `:165–185`; `docs/srs/access/rbac-matrix.md`.
