# Operations use case descriptions

**Draft, 2026-11-07.** Actor associations describe current RBAC where stated; target service/action grants are separate and mostly not implemented. A listed supporting actor is a collaborator or decision maker, never an automatic permission grant. Source references are in each case.

## UC-PM-009 — Manage squad repositories
- **ID:** `UC-PM-009`
- **Name:** Manage squad repositories
- **Goal:** Associate a Git repository with the assigned squad.
- **Actors:** Primary: PM. Supporting: None identified for this operation.
- **Trigger:** Add or remove repository.
- **Preconditions:** Active PM membership; squads.repositories.manage grant.
- **Main flow:** 1. Add or remove repository. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate squad ownership and record the repository change without exposing stored token in list output. 4. Squad repository set updated.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Other squad, invalid repository or no grant: reject.
- **Postconditions:** Squad repository set updated.
- **Business rules:** Active PM membership restricts repository changes to assigned squad.
- **Related requirement IDs:** `FR-PM-009`
- **Implementation status:** PARTIAL — PM route exists, grant absent.
- **Permission/evidence:** `squads.repositories.manage`; target grant/scope policy. Evidence: `src/modules/squads/squads.controller.ts:125–137`; `src/modules/squads/squads.service.ts:188–278`.

## UC-SYS-011 — Ingest product telemetry
- **ID:** `UC-SYS-011`
- **Name:** Ingest product telemetry
- **Goal:** Record product metrics
- **Actors:** Primary: Product telemetry producer. Supporting: None required by this use case.
- **Trigger:** Producer posts metrics with product key.
- **Preconditions:** Registered product and matching API key.
- **Main flow:** 1. Producer posts metrics with product key. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate key and aggregate values into hourly records. 4. Hourly telemetry updated.
- **Alternative flow:** No alternate authenticated producer flow is evidenced.
- **Exceptions:** Invalid key/payload: reject.
- **Postconditions:** Hourly telemetry updated.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-030`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/telemetry/telemetry.controller.ts:41–49`; `src/modules/telemetry/telemetry.service.ts:25–115`.

## UC-SYS-012 — View current sprint
- **ID:** `UC-SYS-012`
- **Name:** View current sprint
- **Goal:** Know active sprint number
- **Actors:** Primary: Authenticated user. Supporting: None required by this use case.
- **Trigger:** User requests sprint setting.
- **Preconditions:** Authenticated session.
- **Main flow:** 1. User requests sprint setting. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall return the current sprint value. 4. No state change.
- **Alternative flow:** No alternate user flow is evidenced.
- **Exceptions:** Unauthorized session: deny.
- **Postconditions:** No state change.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-031`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/settings/settings.controller.ts:60–70`.

## UC-SYS-013 — View dashboard
- **ID:** `UC-SYS-013`
- **Name:** View dashboard
- **Goal:** Inspect permitted dashboard/score data
- **Actors:** Primary: Authenticated user; CTO; CFO; CEO. Supporting: None required by this use case.
- **Trigger:** User opens a dashboard.
- **Preconditions:** Authenticated and current route role where restricted.
- **Main flow:** 1. User opens a dashboard. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall return the requested personal, CTO or CFO dashboard within current route scope. 4. No state change.
- **Alternative flow:** Personal and executive dashboards are separate current routes; target service grants TBD.
- **Exceptions:** Missing current role or requested data: deny.
- **Postconditions:** No state change.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-032`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/dashboard/dashboard.controller.ts:15–52`.

## UC-SYS-014 — Subscribe to event room
- **ID:** `UC-SYS-014`
- **Name:** Subscribe to event room
- **Goal:** Receive scoped events
- **Actors:** Primary: Authenticated subscriber (target). Supporting: None required by this use case.
- **Trigger:** Subscriber requests room join.
- **Preconditions:** Target room scope approved; current gateway has no auth.
- **Main flow:** 1. Subscriber requests room join. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall authenticate subscriber and authorize requested room before subscription. 4. Only permitted event stream joined.
- **Alternative flow:** Current source joins without these checks; target is PROPOSED.
- **Exceptions:** No session or out-of-scope room: reject.
- **Postconditions:** Only permitted event stream joined.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-033`
- **Implementation status:** PROPOSED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/events/events.gateway.ts:25–39`; `docs/srs/access/authorization-gaps.md` GAP-01.

## UC-SYS-015 — Exchange secure notice
- **ID:** `UC-SYS-015`
- **Name:** Exchange secure notice
- **Goal:** Deliver and acknowledge protected notice
- **Actors:** Primary: Notice sender; notice recipient. Supporting: Notice recipient acknowledges sender notice.
- **Trigger:** Sender dispatches; recipient reads/acknowledges.
- **Preconditions:** Current sender CPO/CEO; recipient registered key; target grants TBD.
- **Main flow:** 1. Sender dispatches; recipient reads/acknowledges. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall use the selected versioned envelope and separate authentication tag for web/API exchange. 4. Notice delivered and recipient acknowledgment recorded where applicable.
- **Alternative flow:** Current browser clients place ciphertext and tag together in `data`; dispatch does not require a separate `tag`. The selected versioned separate-tag format is PLANNED, and end-to-end delivery was not tested.
- **Exceptions:** Invalid tag/version/signature or unauthorized sender/recipient: reject.
- **Postconditions:** Notice delivered and recipient acknowledgment recorded where applicable.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-034`
- **Implementation status:** PLANNED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/notices/notices.controller.ts:55–190`; `frontend/lib/notice-crypto.ts:74–89`; `public/app.js:2547–2562`.

## UC-SYS-022 — Read performance score
- **ID:** `UC-SYS-022`
- **Name:** Read performance score
- **Goal:** Inspect personal or allowed score data
- **Actors:** Primary: Authenticated user. Supporting: None required by this use case.
- **Trigger:** User opens score view.
- **Preconditions:** Current authenticated route; target scope TBD.
- **Main flow:** 1. User opens score view. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall return stored or computed score information under implemented route behavior. 4. No state change.
- **Alternative flow:** Current score list scope may exceed desired target scope.
- **Exceptions:** Unauthorized session: deny.
- **Postconditions:** No state change.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/dashboard/dashboard.controller.ts:15–52`; `src/modules/tasks/tasks.service.ts:76–209`.

## UC-SYS-023 — Set current sprint
- **ID:** `UC-SYS-023`
- **Name:** Set current sprint
- **Goal:** Change active sprint number
- **Actors:** Primary: Current CEO/CFO/CTO/CPO. Supporting: None required by this use case.
- **Trigger:** Executive submits sprint number.
- **Preconditions:** Current executive route; target grant TBD.
- **Main flow:** 1. Executive submits sprint number. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall store the current sprint setting. 4. New sprint value visible to authenticated users.
- **Alternative flow:** No formal sprint closure workflow is evidenced.
- **Exceptions:** Invalid value or missing current role: reject.
- **Postconditions:** New sprint value visible to authenticated users.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/settings/settings.controller.ts:66–70`; `src/modules/settings/settings.service.ts:138–140`.

## UC-SYS-024 — Resolve squad chaos event
- **ID:** `UC-SYS-024`
- **Name:** Resolve squad chaos event
- **Goal:** Clear an active squad event
- **Actors:** Primary: Current PM/CEO. Supporting: None required by this use case.
- **Trigger:** Actor requests resolution.
- **Preconditions:** Current PM belongs to target squad or CEO route access.
- **Main flow:** 1. Actor requests resolution. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall mark eligible event resolved. 4. Squad event no longer active.
- **Alternative flow:** CEO can resolve across squads; target grant TBD.
- **Exceptions:** Wrong squad, event state or role: reject.
- **Postconditions:** Squad event no longer active.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/chaos/chaos.controller.ts:64–69`; `src/modules/chaos/chaos.service.ts:133–140`.

## UC-SYS-028 — Create product
- **ID:** `UC-SYS-028`
- **Name:** Create product
- **Goal:** Register product telemetry source
- **Actors:** Primary: Current PM/CTO/CPO/CEO. Supporting: None required by this use case.
- **Trigger:** Actor submits product details.
- **Preconditions:** Current route role; PM squad scope if applicable.
- **Main flow:** 1. Actor submits product details. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall create product and its API key under current service checks. 4. Product can submit keyed telemetry.
- **Alternative flow:** Key rotation policy remains UNVERIFIED.
- **Exceptions:** Invalid squad or unauthorized caller: reject.
- **Postconditions:** Product can submit keyed telemetry.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/telemetry/telemetry.controller.ts:51–59`; `src/modules/telemetry/telemetry.service.ts:117–167`.

## UC-SYS-030 — Recalculate valuations
- **ID:** `UC-SYS-030`
- **Name:** Recalculate valuations
- **Goal:** Refresh squad valuation figures.
- **Actors:** Primary: Current CFO/CEO. Supporting: None required by this use case.
- **Trigger:** Finance actor requests recalculation.
- **Preconditions:** Current CFO route or CEO override.
- **Main flow:** 1. Finance actor requests recalculation. 2. The system checks the stated preconditions and current access rule; target service grant and scope remain undecided. 3. The system shall run the dashboard valuation recalculation. 4. Updated valuation data is available.
- **Alternative flow:** No automatic user-triggered alternative is established here.
- **Exceptions:** Unauthorized caller or calculation failure: reject/report.
- **Postconditions:** Updated valuation data is available.
- **Business rules:** Current dashboard method applies; target grant and frequency are UNVERIFIED.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED as a current source operation; target ABAC grant UNVERIFIED.
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/dashboard/dashboard.controller.ts:39–43`; `src/modules/dashboard/dashboard.service.ts:453–454`.

## UC-SYS-032 — Manage system setting
- **ID:** `UC-SYS-032`
- **Name:** Manage system setting
- **Goal:** Change a system configuration value.
- **Actors:** Primary: Current CEO. Supporting: None required by this use case.
- **Trigger:** CEO submits setting update.
- **Preconditions:** Current CEO route access.
- **Main flow:** 1. CEO submits setting update. 2. The system checks the stated preconditions and current access rule; target service grant and scope remain undecided. 3. The system shall validate and store the setting value. 4. Setting value updated.
- **Alternative flow:** Current sprint selection is a separate executive action, UC-SYS-023.
- **Exceptions:** Invalid value or missing current role: reject.
- **Postconditions:** Setting value updated.
- **Business rules:** Current setting restrictions apply; target grant remains UNVERIFIED.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED as a current source operation; target ABAC grant UNVERIFIED.
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/settings/settings.controller.ts:44–82`; `src/modules/settings/settings.service.ts:84–89`.
