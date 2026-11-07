# Cross-role workflow catalog

**Basis:** source-level audit at 2026-11-07. `IMPLEMENTED` here means the described route and service path exists; runtime behavior in a separate deployment is **UNVERIFIED**. Roles named below are current roles. Current `CPO` combines people/product work; target CHRO is distinct and the owner assigned it payroll approval, but CHRO is not a current code role (`prisma/schema.prisma:14–21`; `docs/srs/DECISIONS.md:7`; `docs/srs/access/HANDOFF.md`). Each workflow's steps are ordered by code path or an explicit inter-handler dependency; a multi-step process is not claimed to run automatically unless the source calls the next step. Stable workflow IDs are `WF-01` onward.

## WF-01 — Invite, enroll and assign a worker

**Status: IMPLEMENTED current path; PARTIAL target multi-role/CHRO model.** Initiator: CEO/CFO/CTO/CPO sends an invitation, or CEO/CPO creates a user directly. Trigger: a staffing decision. Inputs: email, role, optional target squad; invitation acceptance supplies token, password, name and optional student ID. Outputs: active `User`, personal wallet, optional `SquadMembership`, accepted invitation and login tokens. Sources: `src/modules/invitations/invitations.controller.ts:15–59`; `src/modules/invitations/invitations.service.ts:28–74`, `:322–430`; `src/modules/users/users.controller.ts:91–136`; `src/modules/users/users.service.ts:46–94`; `prisma/schema.prisma:237–250`, `:342–355`.

1. **Executive/CEO:** choose an existing role. Service checks institutional email, duplicate account and role existence; non-CEO executive may invite only PM or Developer. Invitation stores hashed token, expiry, inviter and optional squad (`src/modules/invitations/invitations.service.ts:28–99`). CEO/CPO direct creation validates role/email and creates user plus wallet (`src/modules/users/users.service.ts:46–94`).
2. **Invitee:** opens token and accepts. Service rejects invalid, expired, consumed or conflicting token/email/student ID (`src/modules/invitations/invitations.service.ts:322–370`).
3. **System:** one transaction consumes invitation, creates user/wallet and, if target squad exists, creates full-allocation PM or Developer membership; then issues tokens (`src/modules/invitations/invitations.service.ts:372–430`).
4. **Current CPO/CEO:** may later add, remove or transfer squad membership. Add checks allocation total ≤1, sole active PM and PM allocation =1. Transfer closes source, opens destination and charges destination; removal closes membership and charges source (`src/modules/squads/squads.controller.ts:153–175`; `src/modules/squads/squads.service.ts:357–523`).

**Decision and completion:** no approval gate is coded for an invitation or membership change; successful acceptance plus wallet/membership transaction completes enrollment. A nonexistent invited squad yields a user without membership; a failed fee posting prevents membership removal/transfer in its transaction. Future CHRO ownership of account/membership work is **UNVERIFIED**. The `User.role` field holds only one role; custom roles lack general permissions (`prisma/schema.prisma:237–250`, `:1042–1052`; `src/common/guards/roles.guard.ts:15–33`).

## WF-02 — Select the active sprint and plan squad work

**Status: IMPLEMENTED current setting/task creation; UNVERIFIED formal sprint closure or planning approval.** Initiator: CEO/CFO/CTO/CPO changes the active sprint, or squad PM creates tasks. Trigger: start/planning of a work period. Inputs: `sprintNumber`, task squad/title/story points/assignees/due date/optional milestone. Outputs: `SystemSetting.CURRENT_SPRINT`, `Task`, `TaskAssignee`, initial status and optional performance snapshot. Sources: `src/modules/settings/settings.controller.ts:60–70`; `src/modules/settings/settings.service.ts:138–140`; `src/modules/tasks/tasks.controller.ts:127–151`; `src/modules/tasks/tasks.service.ts:226–335`, `:335–412`; `prisma/schema.prisma:412–495`.

1. **Executive:** posts positive integer current sprint; service upserts setting. All authenticated users may read it (`src/modules/settings/settings.controller.ts:60–70`).
2. **Squad PM or CTO/CPO/CEO:** creates a task in a permitted squad. PM uses the active sprint; CTO/CPO/CEO can provide another sprint number (`src/modules/tasks/tasks.service.ts:226–247`, `:456–466`).
3. **System:** deduplicates collaborators; first assignee is primary for metrics. Task starts `TODO` when assigned and a sprint exists, otherwise `BACKLOG`; update can move backlog to todo after assignment or reverse it after unassignment (`src/modules/tasks/tasks.service.ts:248–285`, `:335–412`).

**Alternative/failure/completion:** story points outside 1–13 or unauthorized squad management fail. The task is planned when stored and appears in its squad list; there is no implemented sprint-wide approval or close operation in these handlers. A planned task may link a client milestone, but task creation does not by itself approve the milestone (`src/modules/tasks/tasks.service.ts:230–278`; `src/modules/clients/clients.service.ts:131–166`).

## WF-03 — Perform, review and close a task

**Status: IMPLEMENTED current Git-only completion; PARTIAL owner target for non-code evidence.** Initiator: an assigned worker or squad PM starts a `TODO` task. Trigger: work begins. Inputs: task ID, PR URL or commit hash at submission, PM feedback, CTO critique/decision. Outputs: task state, evidence fields, reviewer IDs/timestamps, `TaskAuditEvent`, score updates and possibly citation/ledger fine. Sources: `src/modules/tasks/tasks.controller.ts:127–190`; `src/modules/tasks/tasks.service.ts:11–69`, `:487–718`; `prisma/schema.prisma:412–495`; `docs/srs/DECISIONS.md:13`.

1. **Assignee/PM:** start `TODO → IN_PROGRESS`; lockout and assignee/squad-management checks apply (`src/modules/tasks/tasks.service.ts:487–506`).
2. **Assigned worker:** submit `IN_PROGRESS → FLAGGED_COMPLETE` with valid PR URL or 7–40 hex commit hash. Current code requires Git proof even for non-code work (`src/modules/tasks/tasks.service.ts:507–545`).
3. **Squad PM or CEO:** verify `FLAGGED_COMPLETE → PM_VERIFIED`, unless primary assignee equals reviewer; or reject back to `IN_PROGRESS`, with optional premature flag and performance penalty (`src/modules/tasks/tasks.service.ts:546–595`).
4. **CTO or CEO:** verify `PM_VERIFIED → CTO_VERIFIED` only without active membership in the task squad; or reject to `IN_PROGRESS`, issuing code citation/fine and PM/developer score effects (`src/modules/tasks/tasks.service.ts:597–685`; `src/modules/audit/audit.service.ts:20–91`).
5. **Squad PM, CTO/CPO or CEO at service level:** close `CTO_VERIFIED → CLOSED`; recompute scores. The controller exposes PM/CTO and CEO via override; CPO is not annotated on close, so it cannot reach this HTTP handler despite service permissiveness (`src/modules/tasks/tasks.controller.ts:187–190`; `src/modules/tasks/tasks.service.ts:687–699`).

**Decision and completion:** PM and CTO review are distinct gates. Rejection returns work to progress; invalid transition, missing proof, lockout or reviewer conflict blocks that step. `CLOSED` is terminal in the allowed-state map. A transition writes a task, then a separate audit event and emits squad event; those operations are not wrapped in one transaction in this method (`src/modules/tasks/tasks.service.ts:11–69`). **PLANNED:** non-code tasks may submit a relevant artifact, link or written outcome for reviewer approval (`docs/srs/DECISIONS.md:13`).

## WF-04 — Recompute worker and squad performance

**Status: IMPLEMENTED score computation and scheduled refresh; UNVERIFIED business use of scores for personnel decisions.** Initiator: task creation, CTO review, task closure, PM premature rejection, or six-hour scheduled job. Inputs: task assignments, story points, due dates, PM/CTO decisions, premature flags, bounty contributions and current sprint. Outputs: `DeveloperPerformanceSnapshot` DPI and `PmPerformanceSnapshot` PMHI; daily squad health snapshots use account balance, payroll burn, escrow and tasks. Sources: `src/modules/tasks/tasks.service.ts:76–224`, `:276–281`, `:578–595`, `:618–685`, `:687–699`; `src/modules/dashboard/dashboard.service.ts:76–184`; `prisma/schema.prisma:898–950`.

1. **System:** reads primary assigned tasks for a developer's sprint; calculates completed points, timeliness, CTO pass rate, premature count and bounty contribution; upserts DPI (`src/modules/tasks/tasks.service.ts:76–144`).
2. **System:** reads one squad's sprint tasks and PM reviewer results; calculates velocity accuracy, CTO agreement, on-time rate and CTO override demerit; upserts PMHI (`src/modules/tasks/tasks.service.ts:145–209`).
3. **System:** cron refreshes active Developer users and active PM memberships every six hours; task review actions also trigger recomputation (`src/modules/tasks/tasks.service.ts:210–224`, `:618–699`).
4. **System:** daily refresh computes valuation, runway and health for active squads, then upserts `SquadHealthSnapshot` (`src/modules/dashboard/dashboard.service.ts:76–184`).

**Alternative/failure/completion:** scores are clamped to 0–100; no tasks can produce default high scores. The scheduled method has no human approval gate. If a called computation fails, completion of that invocation is **UNVERIFIED** without runtime evidence. No source here authorizes an automatic payroll tier, dismissal or bonus solely from DPI/PMHI. The owner target tracks non-code evidence too; score formula adaptation is **UNVERIFIED** (`docs/srs/DECISIONS.md:13`).

## WF-05 — Submit and settle squad payroll

**Status: IMPLEMENTED current PM→CPO/CEO settlement; PARTIAL target CHRO approval.** Initiator: squad PM (CEO can pass role guard and service) submits for a lab. Inputs: squad, lab number, optional sprint, recipient/tier/amount/justification line items; reviewer chooses approve or reject with reason. Outputs: `PayrollProposal` and `PayrollLineItem`; on approval, wallet/treasury balances, one ledger transaction with entries, audit record and event. Sources: `src/modules/payroll/payroll.controller.ts:89–110`; `src/modules/payroll/payroll.service.ts:125–327`; `prisma/schema.prisma:512–545`.

1. **PM/CEO:** submit. Service checks active PM membership unless CEO, budget, unique recipients, tier caps, active recipient membership and unique squad/lab proposal (`src/modules/payroll/payroll.service.ts:125–181`).
2. **Current CPO/CEO:** read submitted proposals and either reject with reason or approve and disburse. Service rechecks reviewer role, recipient membership and wallet, claims `SUBMITTED`, posts a balanced treasury-to-wallet batch and writes audit within one database transaction (`src/modules/payroll/payroll.service.ts:183–327`).
3. **System:** on successful commit, publishes balance updates and squad payroll event; an identical settled key replays the original outcome (`src/modules/payroll/payroll.service.ts:200–317`).

**Failure/alternative/completion:** over-budget, duplicate lab/recipient, departed recipient, missing wallet, insufficient treasury, rejected or already approved state block settlement. Rejection ends as `REJECTED`; successful approval ends as `APPROVED` and ledgered. **PLANNED by owner:** CHRO handles payroll approval. The owner has not specified whether CHRO also executes the payment, rejects, or shares override authority; these target steps are **UNVERIFIED** (`docs/srs/access/HANDOFF.md`).

## WF-06 — Rank squads and execute a sprint payout

**Status: PARTIAL against intended whole-batch atomicity; IMPLEMENTED submit→approve→per-squad execute path.** Initiator: CFO submits rankings for a sprint; CEO approves; CFO executes. Inputs: sprint number, every active squad and unique contiguous 1..N rank, payout configuration and idempotency key. Outputs: `SprintPayout`, items, ledger entries, tax to caller wallet, net treasury credits, possible PM bonus/equity dividend, executed timestamp. Sources: `src/modules/sprint-payouts/sprint-payouts.controller.ts:37–57`; `src/modules/sprint-payouts/sprint-payouts.service.ts:24–207`; `prisma/schema.prisma:955–981`; `docs/srs/DECISIONS.md:11`.

1. **CFO (CEO passes guard):** submit exactly one ranking per active squad. Service rejects duplicate/noncontiguous ranks, inactive/count mismatch or existing sprint payout; stores `PROPOSED` batch and amounts (`src/modules/sprint-payouts/sprint-payouts.service.ts:24–75`).
2. **CEO:** changes `PROPOSED → APPROVED`; audit write is best effort (`src/modules/sprint-payouts/sprint-payouts.service.ts:85–106`).
3. **CFO (CEO passes guard):** checks approved state, then loops through items. Each item posts reserve debit, caller-wallet tax, squad net credit, possible dividend and top-three PM bonus. After loop, batch becomes `EXECUTED` (`src/modules/sprint-payouts/sprint-payouts.service.ts:108–190`).

**Failure/alternative/completion:** if item posting fails, earlier item postings may remain and batch may remain `APPROVED`; no enclosing batch transaction exists. Replaying after a partial failure has item-level idempotency but is not proven all-or-nothing. CEO override can execute and receive the CFO-labeled tax. **PROPOSED:** owner-oriented all-or-nothing batch rule is in `docs/srs/DECISIONS.md:11`; actor/recipient policy is **UNVERIFIED** (`docs/srs/access/authorization-gaps.md`, GAP-03).

## WF-07 — Request, govern, disburse and repay a squad loan

**Status: IMPLEMENTED route chain; PARTIAL relative to strict “2-of-3 then CEO” claim.** Initiator: squad PM requests emergency funds when treasury is below threshold. Inputs: squad, principal, board proposal referencing loan ID, board votes, CEO decision and CFO disbursement. Outputs: `Loan`, `BoardDecision`, votes, ledger disbursement/repayment, due date and possibly default/health state. Sources: `src/modules/loans/loans.controller.ts:23–43`; `src/modules/loans/loans.service.ts:24–195`; `src/modules/governance/governance.controller.ts:50–71`; `src/modules/governance/governance.service.ts:20–130`; `prisma/schema.prisma:570–592`, `:754–784`.

1. **PM/CEO:** apply. Service requires squad PM unless CEO, positive principal, treasury below configured threshold and no active unrepaid loan; creates `ACTIVE` loan with interest and total due, not yet disbursed (`src/modules/loans/loans.service.ts:24–60`).
2. **CFO/CTO/CPO board member:** separately proposes `LOAN_APPROVAL` decision with loan reference. Board members other than proposer vote once; two approvals set `APPROVED`, two rejections set `REJECTED` (`src/modules/governance/governance.service.ts:20–94`).
3. **CEO:** signs off or vetoes. Current method accepts a still-`PROPOSED` decision; linked approved loan is marked `ceoApproved` (`src/modules/governance/governance.service.ts:96–130`).
4. **CFO (CEO passes guard):** disburses only when loan's CEO flag or linked CEO-approved decision exists, posts reserve→treasury transfer and stores disbursement/due date (`src/modules/loans/loans.service.ts:89–145`).
5. **Squad PM/CEO:** repays principal to reserve and interest to CFO wallet if active, disbursed and treasury can cover total; loan becomes `REPAID`. Listing overdue disbursed loans lazily changes them to `DEFAULTED` and squad health to `BANKRUPT_RISK` (`src/modules/loans/loans.service.ts:62–87`, `:147–195`).

**Decision/completion:** `REPAID` completes normal repayment; `DEFAULTED` is alternative terminal state in this path. The board proposal is not automatically created by loan application. CEO can sign before two votes, so the strict two-vote prerequisite is not implemented; it is **UNVERIFIED** whether the unilateral CEO path is intended policy. Loan disbursement and status update are separate operations, so a post-ledger failure may leave state inconsistent (`src/modules/loans/loans.service.ts:89–145`).

## WF-08 — Approve a client milestone and release escrow

**Status: IMPLEMENTED internal route chain; UNVERIFIED external client acceptance.** Initiator: CEO/CPO/CFO creates client/contract; CEO/CPO/CFO/PM adds a milestone. Inputs: client/contact, contract shares/value, milestone amount/date, escrow amount, assigned squad, CTO pass, internal acceptance flag. Outputs: client/contract/milestone, escrow and revenue ledger entries, possible equity dividend, status `PAID` or `DISPUTED`. Sources: `src/modules/clients/clients.controller.ts:70–119`; `src/modules/clients/clients.service.ts:24–231`; `prisma/schema.prisma:812–862`.

1. **CEO/CPO/CFO:** create client and signed contract; shares must total 1.00. **PM or same executives:** add milestone (`src/modules/clients/clients.service.ts:24–90`).
2. **CEO/CPO/CFO:** fund milestone by reserve→escrow transfer; contract becomes active, milestone `IN_PROGRESS`. **CEO/CPO/CTO/PM:** assign a squad; handler does not check PM's squad scope (`src/modules/clients/clients.controller.ts:98–107`; `src/modules/clients/clients.service.ts:92–129`).
3. **CTO/CEO:** audit `IN_PROGRESS`/`CTO_AUDIT`. Pass moves to `CLIENT_REVIEW`; fail returns to `IN_PROGRESS` (`src/modules/clients/clients.controller.ts:110–113`; `src/modules/clients/clients.service.ts:131–149`).
4. **Assigned squad PM or CEO/CPO:** records acceptance. Reject marks contract disputed and milestone back to `CTO_AUDIT`; accept requires CTO approval, assigned squad and sufficient contract escrow, posts waterfall, pays optional equity dividend, updates balances/value and marks milestone `PAID` (`src/modules/clients/clients.service.ts:151–231`).

**Failure/alternative/completion:** bad state, missing squad or insufficient escrow stop acceptance; rejection leaves dispute requiring later handling. `PAID` completes this internal workflow. No authenticated client actor or client-side proof is present; “client acceptance” is an internal attestation. Ledger transfer, optional dividend and later status/value updates are separate operations, so whole-workflow atomicity is **UNVERIFIED** (`src/modules/clients/clients.service.ts:199–231`). Product/client approval authority after CPO/CHRO split remains **UNVERIFIED**.

## WF-09 — Request and approve reserve funding for a pool

**Status: IMPLEMENTED current finance/CEO path.** Initiator: CFO requests pool funding when extra funds are needed. Inputs: amount and memo. Outputs: `PoolFundingRequest`, audit record, reserve/capital ledger transfer and approval state. Source: `src/modules/ledger/ledger.controller.ts:189–257`; `prisma/schema.prisma:497–510`.

1. **CFO (CEO passes guard):** creates a pending request; request and audit log are written together (`src/modules/ledger/ledger.controller.ts:198–209`).
2. **CEO:** reads request; must not be the same user as requester; approval calls pool funding transfer (`src/modules/ledger/ledger.controller.ts:210–257`).
3. **System:** records funding ledger movement and request approval through the controller's funding routine; CEO can also take a direct funding route without request (`src/modules/ledger/ledger.controller.ts:219–257`).

**Failure/alternative/completion:** self-approval is rejected; insufficient/frozen accounts or posting failure prevents transfer. A successful approved request and ledger transfer complete the request path. Whether direct CEO funding needs an independent checker is **UNVERIFIED**. CEO's guard override allows CEO to create a request, but the same identity cannot approve it (`src/common/guards/roles.guard.ts:27–33`; `src/modules/ledger/ledger.controller.ts:198–215`).

## WF-10 — Certify a provider, purchase an asset or book consultancy

**Status: IMPLEMENTED current linked paths; PARTIAL end-to-end purchase/booking consistency.** Initiator: a worker applies for a CTO provider certification; an author lists an asset, or squad PM/CTO buys/books. Inputs: certification type/application, listing/price or consultant/squad/time, reviewer decision, booking notes and links. Outputs: certification, listing/purchase or booking, ledger transfer and completion record. Sources: `src/modules/certifications/certifications.controller.ts:44–76`; `src/modules/certifications/certifications.service.ts:19–109`, `:145–158`; `src/modules/marketplace/marketplace.controller.ts:39–74`; `src/modules/marketplace/marketplace.service.ts:24–143`; `src/modules/consultancy/consultancy.controller.ts:37–61`; `src/modules/consultancy/consultancy.service.ts:26–166`.

1. **Worker/CTO:** worker applies; CTO reviews queue and approves/rejects. CTO/CEO bypasses certification check for provider actions (`src/modules/certifications/certifications.service.ts:19–109`, `:145–158`).
2. **Certified author/CTO:** creates listing. CTO authored listing is immediately verified; other listing can be verified or delisted by CTO/CEO (`src/modules/marketplace/marketplace.service.ts:24–38`, `:128–143`).
3. **Buyer PM/CTO/CEO:** purchases for squad. PM must be its active PM; duplicate purchase, bankrupt-risk health and Tier F technical score block it. Successful treasury→author transfer is followed by `MarketplacePurchase` creation (`src/modules/marketplace/marketplace.service.ts:73–126`).
4. **Booking PM/CTO/CEO:** books a certified consultant if squad is eligible, start time future and weekly cap not reached. Treasury→escrow transfer precedes booking row. **Assigned consultant:** submits ≥50-word notes and a link; escrow pays consultant/reserve, then booking becomes `COMPLETED`. **PM/CTO/CEO:** may cancel scheduled booking >2 hours before start for refund (`src/modules/consultancy/consultancy.service.ts:26–166`).

**Failure/alternative/completion:** listing purchase completes when ledger and purchase row both succeed; booking completes at `COMPLETED` or `CANCELLED`. Ledger posting and purchase/booking/status records are not enclosed in one transaction in these methods, so partial outcomes are possible. Booking cancellation has no caller-to-booking ownership check beyond route role, documented in `docs/srs/access/authorization-gaps.md` GAP-05. Whether every non-code consultancy deliverable must carry a PR under the owner’s revised task-evidence policy is **UNVERIFIED** (`docs/srs/DECISIONS.md:13`).
