# Technical use case descriptions

**Draft, 2026-11-07.** Actor associations describe current RBAC where stated; target service/action grants are separate and mostly not implemented. A listed supporting actor is a collaborator or decision maker, never an automatic permission grant. Source references are in each case.

## UC-CTO-001 — Read technical review queue
- **ID:** `UC-CTO-001`
- **Name:** Read technical review queue
- **Goal:** Inspect tasks awaiting technical review.
- **Actors:** Primary: CTO. Supporting: None identified for this operation.
- **Trigger:** Open pending queue.
- **Preconditions:** Authenticated with tasks.review.read; task is PM_VERIFIED.
- **Main flow:** 1. Open pending queue. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall return only tasks in the grantee’s defined review scope and PM_VERIFIED state. 4. Queue is read without task mutation.
- **Alternative flow:** A squad filter may narrow the current queue; target visibility scope is undecided.
- **Exceptions:** Absent grant or out-of-scope task: deny/filter.
- **Postconditions:** Queue is read without task mutation.
- **Business rules:** BR-006; only PM_VERIFIED tasks enter the current technical queue.
- **Related requirement IDs:** `FR-CTO-001`
- **Implementation status:** PARTIAL — current CTO/CEO route lists PM_VERIFIED tasks, but no service grant.
- **Permission/evidence:** `tasks.review.read`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:149–154`; `src/modules/tasks/tasks.service.ts:708–718`.

## UC-CTO-002 — Pass task quality review
- **ID:** `UC-CTO-002`
- **Name:** Pass task quality review
- **Goal:** Approve PM-verified work after conflict check.
- **Actors:** Primary: CTO. Supporting: PM and assigned worker
- **Trigger:** Submit pass.
- **Preconditions:** Task PM_VERIFIED; no active membership in its squad.
- **Main flow:** 1. Submit pass. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record the reviewer and move the task to CTO_VERIFIED when the technical-review grant, state and conflict checks pass. 4. Task has technical approval.
- **Alternative flow:** A failed quality review follows UC-CTO-003.
- **Exceptions:** Wrong state, active squad membership or no grant: reject.
- **Postconditions:** Task has technical approval.
- **Business rules:** BR-006, BR-009; active squad membership conflicts with technical review.
- **Related requirement IDs:** `FR-CTO-002`
- **Implementation status:** PARTIAL — CTO route and conflict gate exist; service grant absent.
- **Permission/evidence:** `tasks.review.approve`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:193–198`; `src/modules/tasks/tasks.service.ts:604–639`; WF-03.

## UC-CTO-003 — Reject task quality review
- **ID:** `UC-CTO-003`
- **Name:** Reject task quality review
- **Goal:** Return deficient PM-verified work with a citation.
- **Actors:** Primary: CTO. Supporting: PM and assigned worker
- **Trigger:** Submit rejection.
- **Preconditions:** Task PM_VERIFIED; no active membership in its squad.
- **Main flow:** 1. Submit rejection. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall require a critique of at least 20 characters and citation type, issue the citation, and return the task to IN_PROGRESS. 4. Task and citation record the outcome.
- **Alternative flow:** A passing review follows UC-CTO-002.
- **Exceptions:** Wrong state, conflict, invalid critique, citation/posting failure or no grant: reject or surface partial failure.
- **Postconditions:** Task and citation record the outcome.
- **Business rules:** BR-006, BR-009; rejection requires a critique and citation type.
- **Related requirement IDs:** `FR-CTO-003`
- **Implementation status:** PARTIAL — core path exists; service grant absent and cross-write atomicity unverified.
- **Permission/evidence:** `tasks.review.reject`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:101–120`, `:199–204`; `src/modules/tasks/tasks.service.ts:642–691`.

## UC-CTO-004 — Review certification application
- **ID:** `UC-CTO-004`
- **Name:** Review certification application
- **Goal:** Decide a pending technical certification.
- **Actors:** Primary: CTO. Supporting: Applicant
- **Trigger:** Submit approval or rejection.
- **Preconditions:** Pending application and certifications.review grant.
- **Main flow:** 1. Submit approval or rejection. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record the decision and reviewer for a pending application using the implemented score and cooldown rules. 4. Certification state updated.
- **Alternative flow:** The reviewer may reject below the configured threshold; approval requires at least the threshold.
- **Exceptions:** Wrong state, invalid score or no grant: reject.
- **Postconditions:** Certification state updated.
- **Business rules:** Configured pass threshold 80 by default, score 0–100 and rejection cooldown 7 days (source cited below).
- **Related requirement IDs:** `FR-CTO-004`
- **Implementation status:** PARTIAL — CTO review exists, service grant absent.
- **Permission/evidence:** `certifications.review`; target grant/scope policy. Evidence: `src/modules/certifications/certifications.controller.ts:48–76`; `src/modules/certifications/certifications.service.ts:54–109`.

## UC-CTO-005 — Triage bounty report
- **ID:** `UC-CTO-005`
- **Name:** Triage bounty report
- **Goal:** Verify or reject a cross-squad defect report.
- **Actors:** Primary: CTO. Supporting: Bounty hunter and target squad PM
- **Trigger:** Submit triage.
- **Preconditions:** Existing report and bounty.triage grant.
- **Main flow:** 1. Submit triage. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall apply the report decision and, on verification, post the implemented escrow/pool effects and performance update. 4. Report decision recorded.
- **Alternative flow:** Rejecting the report records a negative triage outcome without the verified payout.
- **Exceptions:** Already decided, insufficient funds, invalid report or no grant: reject; partial posting recovery TBD.
- **Postconditions:** Report decision recorded.
- **Business rules:** A report must meet the bounty report and pool rules in the cited service.
- **Related requirement IDs:** `FR-CTO-005`
- **Implementation status:** PARTIAL — route and business effects exist, service grant absent.
- **Permission/evidence:** `bounty.triage`; target grant/scope policy. Evidence: `src/modules/bounty/bounty.controller.ts:106–111`; `src/modules/bounty/bounty.service.ts:155–241`.

## UC-CTO-006 — Verify marketplace listing
- **ID:** `UC-CTO-006`
- **Name:** Verify marketplace listing
- **Goal:** Approve a listed technical asset.
- **Actors:** Primary: CTO. Supporting: None identified for this operation.
- **Trigger:** Submit verification.
- **Preconditions:** Listing exists and marketplace.verify grant.
- **Main flow:** 1. Submit verification. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall mark an existing listing verified and retain the reviewer identity. 4. Listing is eligible for purchase under current rules.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Missing listing or no grant: reject. Current code does not block verification of a delisted listing.
- **Postconditions:** Listing is eligible for purchase under current rules.
- **Business rules:** Current verification requires an existing listing; no source state restriction beyond existence.
- **Related requirement IDs:** `FR-CTO-006`
- **Implementation status:** PARTIAL — CTO route exists, service grant absent.
- **Permission/evidence:** `marketplace.verify`; target grant/scope policy. Evidence: `src/modules/marketplace/marketplace.controller.ts:63–69`; `src/modules/marketplace/marketplace.service.ts:128–136`.

## UC-CTO-008 — Issue technical citation
- **ID:** `UC-CTO-008`
- **Name:** Issue technical citation
- **Goal:** Record a technical citation against a squad/task.
- **Actors:** Primary: CTO. Supporting: None identified for this operation.
- **Trigger:** Submit citation.
- **Preconditions:** Valid target and audit.citation.create grant.
- **Main flow:** 1. Submit citation. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall create the citation and associated implemented financial/audit records. 4. Citation is recorded.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Invalid target, duplicate key, insufficient funds or no grant: reject or report failure.
- **Postconditions:** Citation is recorded.
- **Business rules:** Citation and ledger rules are enforced by the audit service.
- **Related requirement IDs:** `FR-CTO-008`
- **Implementation status:** PARTIAL — CTO route exists, service grant absent.
- **Permission/evidence:** `audit.citation.create`; target grant/scope policy. Evidence: `src/modules/audit/audit.controller.ts:40–46`; `src/modules/audit/audit.service.ts:20–91`.

## UC-PM-008 — Book consultancy for squad
- **ID:** `UC-PM-008`
- **Name:** Book consultancy for squad
- **Goal:** Reserve certified technical support.
- **Actors:** Primary: PM. Supporting: Assigned consultant
- **Trigger:** Submit booking.
- **Preconditions:** Own active squad, eligible consultant/time, consultancy.book grant.
- **Main flow:** 1. Submit booking. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate certification, health, technical tier, future time and weekly cap before escrow transfer and booking. 4. Booking scheduled.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Other squad, invalid time, cap, insufficient treasury or no grant: reject.
- **Postconditions:** Booking scheduled.
- **Business rules:** Booking requires certified consultant, eligible squad, future time and weekly cap.
- **Related requirement IDs:** `FR-PM-008`
- **Implementation status:** PARTIAL — PM operation exists, grant absent.
- **Permission/evidence:** `consultancy.book`; target grant/scope policy. Evidence: `src/modules/consultancy/consultancy.controller.ts:37–41`; `src/modules/consultancy/consultancy.service.ts:26–94`; WF-10.

## UC-DEV-005 — Report cross-squad defect
- **ID:** `UC-DEV-005`
- **Name:** Report cross-squad defect
- **Goal:** Submit a bounty report against another squad.
- **Actors:** Primary: Developer. Supporting: Bounty reviewer
- **Trigger:** Submit report.
- **Preconditions:** Active squad membership, eligible target, bounty.report grant.
- **Main flow:** 1. Submit report. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate cross-squad target and cooldown/cap before recording the report. 4. Report awaits technical triage.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Same squad, inactive membership, cooldown/cap or no grant: reject.
- **Postconditions:** Report awaits technical triage.
- **Business rules:** Cross-squad reporting and active hunter-squad membership are required.
- **Related requirement IDs:** `FR-DEV-005`
- **Implementation status:** PARTIAL — Developer route exists, service grant absent.
- **Permission/evidence:** `bounty.report`; target grant/scope policy. Evidence: `src/modules/bounty/bounty.controller.ts:91–96`; `src/modules/bounty/bounty.service.ts:87–134`.

## UC-DEV-006 — Apply for technical certification
- **ID:** `UC-DEV-006`
- **Name:** Apply for technical certification
- **Goal:** Request provider certification.
- **Actors:** Primary: Developer. Supporting: Certification reviewer
- **Trigger:** Submit application.
- **Preconditions:** Authenticated and certifications.apply grant.
- **Main flow:** 1. Submit application. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate cooldown and create a pending application. 4. CTO review pending.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Cooldown, invalid application or no grant: reject.
- **Postconditions:** CTO review pending.
- **Business rules:** Certification cooldown and active-certification checks apply.
- **Related requirement IDs:** `FR-DEV-006`
- **Implementation status:** PARTIAL — authenticated route exists, service grant absent.
- **Permission/evidence:** `certifications.apply`; target grant/scope policy. Evidence: `src/modules/certifications/certifications.controller.ts:44–48`; `src/modules/certifications/certifications.service.ts:19–53`; WF-10.

## UC-DEV-007 — Complete assigned consultancy
- **ID:** `UC-DEV-007`
- **Name:** Complete assigned consultancy
- **Goal:** Submit deliverable for a booking assigned to the worker.
- **Actors:** Primary: Developer. Supporting: Booking PM
- **Trigger:** Submit completion.
- **Preconditions:** Booking scheduled, consultant assignment and consultancy.complete grant.
- **Main flow:** 1. Submit completion. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall require at least 50 words of notes and an actionable PR/repository link, release escrow and mark booking completed. 4. Booking completed; payout recorded.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Unassigned consultant, invalid evidence, wrong state or no grant: reject.
- **Postconditions:** Booking completed; payout recorded.
- **Business rules:** Assigned consultant only; at least 50 words and one actionable PR/repository link.
- **Related requirement IDs:** `FR-DEV-007`
- **Implementation status:** PARTIAL — Developer route/assignment check exists, service grant absent.
- **Permission/evidence:** `consultancy.complete`; target grant/scope policy. Evidence: `src/modules/consultancy/consultancy.controller.ts:47–55`; `src/modules/consultancy/consultancy.service.ts:96–139`; WF-10.

## UC-SYS-017 — Create marketplace listing
- **ID:** `UC-SYS-017`
- **Name:** Create marketplace listing
- **Goal:** Offer technical asset
- **Actors:** Primary: Certified author. Supporting: None required by this use case.
- **Trigger:** Author submits listing.
- **Preconditions:** Active marketplace-author certification, except current CTO/CEO bypass.
- **Main flow:** 1. Author submits listing. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate price and create listing with author identity. 4. Listing stored.
- **Alternative flow:** Current CTO-authored listing is auto-verified; target self-review policy TBD.
- **Exceptions:** No certification or nonpositive price: reject.
- **Postconditions:** Listing stored.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/marketplace/marketplace.controller.ts:39–43`; `src/modules/marketplace/marketplace.service.ts:24–38`.

## UC-SYS-018 — Purchase marketplace listing
- **ID:** `UC-SYS-018`
- **Name:** Purchase marketplace listing
- **Goal:** Buy listed asset for squad
- **Actors:** Primary: Current PM/CTO/CEO buyer. Supporting: None required by this use case.
- **Trigger:** Buyer selects listing and squad.
- **Preconditions:** Eligible listing, squad and treasury; current PM own-squad gate.
- **Main flow:** 1. Buyer selects listing and squad. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate purchase eligibility and transfer treasury funds to author before recording purchase. 4. Purchase recorded.
- **Alternative flow:** Ledger success followed by record failure can leave partial outcome.
- **Exceptions:** Duplicate purchase, bankrupt risk, Tier F, insufficient funds or wrong PM squad: reject.
- **Postconditions:** Purchase recorded.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/marketplace/marketplace.controller.ts:52–61`; `src/modules/marketplace/marketplace.service.ts:73–126`.

## UC-SYS-019 — Create bounty target
- **ID:** `UC-SYS-019`
- **Name:** Create bounty target
- **Goal:** Fund a cross-squad bounty target
- **Actors:** Primary: Current PM/CTO/CEO. Supporting: None required by this use case.
- **Trigger:** Actor submits target and pool.
- **Preconditions:** PM owns target squad under current check; treasury has funds.
- **Main flow:** 1. Actor submits target and pool. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall require pool at least 5000 and transfer it to escrow before storing target. 4. Target active and funded.
- **Alternative flow:** Post-ledger record failure can leave an incomplete target.
- **Exceptions:** Wrong PM squad, low pool or insufficient funds: reject.
- **Postconditions:** Target active and funded.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/bounty/bounty.controller.ts:78–83`; `src/modules/bounty/bounty.service.ts:25–61`.

## UC-SYS-020 — Cancel consultancy booking
- **ID:** `UC-SYS-020`
- **Name:** Cancel consultancy booking
- **Goal:** Cancel a scheduled consultancy
- **Actors:** Primary: Current PM/CTO/CEO. Supporting: None required by this use case.
- **Trigger:** Actor requests cancellation.
- **Preconditions:** Scheduled booking and more than two hours before start for refund.
- **Main flow:** 1. Actor requests cancellation. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall mark booking cancelled and apply the implemented refund rule. 4. Booking cancelled; refund posted when eligible.
- **Alternative flow:** Current service lacks caller-to-booking ownership check; target scope UNVERIFIED.
- **Exceptions:** Wrong state or late cancellation: reject.
- **Postconditions:** Booking cancelled; refund posted when eligible.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/consultancy/consultancy.controller.ts:59–61`; `src/modules/consultancy/consultancy.service.ts:140–166`.

## UC-SYS-029 — Delist marketplace listing
- **ID:** `UC-SYS-029`
- **Name:** Delist marketplace listing
- **Goal:** Withdraw a technical asset from listings.
- **Actors:** Primary: Current CTO/CEO. Supporting: None required by this use case.
- **Trigger:** Reviewer requests delisting.
- **Preconditions:** Existing listing; current CTO route or CEO override.
- **Main flow:** 1. Reviewer requests delisting. 2. The system checks the stated preconditions and current access rule; target service grant and scope remain undecided. 3. The system shall mark the listing delisted. 4. Listing no longer appears in active listing results.
- **Alternative flow:** Current service accepts a reason parameter but does not retain the reason; target audit rule is TBD.
- **Exceptions:** Missing listing or unauthorized caller: reject.
- **Postconditions:** Listing no longer appears in active listing results.
- **Business rules:** Current listing state and route restrictions apply.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED as a current source operation; target ABAC grant UNVERIFIED.
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/marketplace/marketplace.controller.ts:70–75`; `src/modules/marketplace/marketplace.service.ts:137–143`.

## UC-SYS-033 — View certification directory
- **ID:** `UC-SYS-033`
- **Name:** View certification directory
- **Goal:** Find certified providers.
- **Actors:** Primary: Authenticated user. Supporting: None required by this use case.
- **Trigger:** User requests consultants or certification by user.
- **Preconditions:** Authenticated session; target read scope TBD.
- **Main flow:** 1. User requests consultants or certification by user. 2. The system checks the stated preconditions and current access rule; target service grant and scope remain undecided. 3. The system shall return current certification/consultant directory records. 4. No certification state changes.
- **Alternative flow:** The CTO pending review queue is separate UC-CTO-004.
- **Exceptions:** Invalid user or unauthenticated caller: reject.
- **Postconditions:** No certification state changes.
- **Business rules:** Current broad authenticated read applies; target visibility is UNVERIFIED.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED as a current source operation; target ABAC grant UNVERIFIED.
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/certifications/certifications.controller.ts:57–70`; `src/modules/certifications/certifications.service.ts:121–143`.
