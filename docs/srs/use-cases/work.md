# Work use case descriptions

**Draft, 2026-11-07.** Actor associations describe current RBAC where stated; target service/action grants are separate and mostly not implemented. A listed supporting actor is a collaborator or decision maker, never an automatic permission grant. Source references are in each case.

## UC-PM-001 — Create squad task
- **ID:** `UC-PM-001`
- **Name:** Create squad task
- **Goal:** Plan work for an assigned squad.
- **Actors:** Primary: PM. Supporting: None identified for this operation.
- **Trigger:** Submit task.
- **Preconditions:** Active PM membership for squad; tasks.create grant.
- **Main flow:** 1. Submit task. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall create the task with squad, sprint, assignees, points and due date after scope validation. 4. Task exists in planned state.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Nonmember, invalid assignee, invalid fields or no grant: reject.
- **Postconditions:** Task exists in planned state.
- **Business rules:** FR-SYS-010 and BR-005.
- **Related requirement IDs:** `FR-PM-001`
- **Implementation status:** PARTIAL — current PM path exists, grant absent.
- **Permission/evidence:** `tasks.create`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:129–133`; `src/modules/tasks/tasks.service.ts:226–285`; WF-02.

## UC-PM-002 — Review submitted squad task
- **ID:** `UC-PM-002`
- **Name:** Review submitted squad task
- **Goal:** Perform first review of flagged work.
- **Actors:** Primary: PM. Supporting: Assigned worker and technical reviewer
- **Trigger:** Submit pass decision.
- **Preconditions:** Task FLAGGED_COMPLETE, active PM membership, not primary assignee.
- **Main flow:** 1. Submit pass decision. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall record PM reviewer and move the task to PM_VERIFIED. 4. Task awaits technical review.
- **Alternative flow:** Failed PM review follows UC-PM-003.
- **Exceptions:** Self-review, wrong state, other squad or no grant: reject.
- **Postconditions:** Task awaits technical review.
- **Business rules:** BR-006, BR-008; primary assignee cannot verify own work.
- **Related requirement IDs:** `FR-PM-002`
- **Implementation status:** PARTIAL — current PM path exists, grant absent.
- **Permission/evidence:** `tasks.review.pmApprove`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:181–186`; `src/modules/tasks/tasks.service.ts:546–568`; WF-03.

## UC-PM-003 — Reject submitted squad task
- **ID:** `UC-PM-003`
- **Name:** Reject submitted squad task
- **Goal:** Return flagged work with feedback.
- **Actors:** Primary: PM. Supporting: Assigned worker
- **Trigger:** Submit rejection.
- **Preconditions:** Task FLAGGED_COMPLETE, active PM membership.
- **Main flow:** 1. Submit rejection. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall require feedback and return task to IN_PROGRESS, recording premature-flag indication and applicable score effects. 4. Assignee can continue work.
- **Alternative flow:** Passing PM review follows UC-PM-002.
- **Exceptions:** Wrong state, other squad, invalid feedback or no grant: reject.
- **Postconditions:** Assignee can continue work.
- **Business rules:** BR-006; required feedback and premature-flag effects are source-defined.
- **Related requirement IDs:** `FR-PM-003`
- **Implementation status:** PARTIAL — current PM path exists, grant absent.
- **Permission/evidence:** `tasks.review.pmReject`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:188–192`; `src/modules/tasks/tasks.service.ts:571–601`; WF-03.

## UC-PM-004 — Close technically approved task
- **ID:** `UC-PM-004`
- **Name:** Close technically approved task
- **Goal:** Finish a task after technical review.
- **Actors:** Primary: PM. Supporting: None identified for this operation.
- **Trigger:** Request close.
- **Preconditions:** Task CTO_VERIFIED and assigned PM scope.
- **Main flow:** 1. Request close. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall transition task to CLOSED and retain actor/time. 4. Task is closed.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Wrong state, other squad or no grant: reject.
- **Postconditions:** Task is closed.
- **Business rules:** BR-006; CTO_VERIFIED is the closure prerequisite.
- **Related requirement IDs:** `FR-PM-004`
- **Implementation status:** PARTIAL — PM/CTO path exists, grant absent.
- **Permission/evidence:** `tasks.close`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:205–209`; `src/modules/tasks/tasks.service.ts:694–706`.

## UC-DEV-001 — Read assigned tasks
- **ID:** `UC-DEV-001`
- **Name:** Read assigned tasks
- **Goal:** See work within active squad/assignment scope.
- **Actors:** Primary: Developer. Supporting: None identified for this operation.
- **Trigger:** Open task list/detail.
- **Preconditions:** Authenticated and tasks.read grant; active assignment or squad scope.
- **Main flow:** 1. Open task list/detail. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall return only tasks in the worker’s authorized scope. 4. Task data displayed without mutation.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** No grant, inaccessible task or missing task: deny/filter.
- **Postconditions:** Task data displayed without mutation.
- **Business rules:** FR-SYS-035 target scope is PROPOSED; current task read scope applies.
- **Related requirement IDs:** `FR-DEV-001`
- **Implementation status:** PARTIAL — current squad-scoped read exists, service grant absent.
- **Permission/evidence:** `tasks.read`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:135–159`; `src/modules/tasks/tasks.service.ts:413–480`.

## UC-DEV-002 — Start assigned task
- **ID:** `UC-DEV-002`
- **Name:** Start assigned task
- **Goal:** Move assigned planned work to in progress.
- **Actors:** Primary: Developer. Supporting: Squad PM
- **Trigger:** Start work.
- **Preconditions:** Task TODO, assignment and tasks.start grant.
- **Main flow:** 1. Start work. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall check assignment and state, then record IN_PROGRESS transition. 4. Task in progress with actor/time.
- **Alternative flow:** No separate successful variant is evidenced; the cited exceptions end this attempt.
- **Exceptions:** Wrong state, lockout, non-assignee or no grant: reject.
- **Postconditions:** Task in progress with actor/time.
- **Business rules:** BR-006 and assignment gate.
- **Related requirement IDs:** `FR-DEV-002`
- **Implementation status:** PARTIAL — current assigned start exists, service grant absent.
- **Permission/evidence:** `tasks.start`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:166–171`; `src/modules/tasks/tasks.service.ts:487–505`; WF-03.

## UC-DEV-003 — Submit code task evidence
- **ID:** `UC-DEV-003`
- **Name:** Submit code task evidence
- **Goal:** Flag assigned code work complete with Git proof.
- **Actors:** Primary: Developer. Supporting: Squad PM and technical reviewer
- **Trigger:** Flag complete.
- **Preconditions:** Task IN_PROGRESS, assignment, tasks.submit grant.
- **Main flow:** 1. Flag complete. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate a PR URL or 7–40 hexadecimal commit hash and record FLAGGED_COMPLETE. 4. Work awaits PM review.
- **Alternative flow:** For a non-code deliverable, the planned alternative is UC-DEV-004.
- **Exceptions:** Missing/invalid proof, wrong state, lockout, non-assignee or no grant: reject.
- **Postconditions:** Work awaits PM review.
- **Business rules:** BR-007, BR-010; current source requires Git proof for every task.
- **Related requirement IDs:** `FR-DEV-003`
- **Implementation status:** PARTIAL — current Git validation exists; service grant absent.
- **Permission/evidence:** `tasks.submit`; target grant/scope policy. Evidence: `src/modules/tasks/tasks.controller.ts:173–180`; `src/modules/tasks/tasks.service.ts:507–545`; WF-03.

## UC-DEV-004 — Submit non-code task evidence
- **ID:** `UC-DEV-004`
- **Name:** Submit non-code task evidence
- **Goal:** Flag assigned non-code work with a relevant artifact, link or written outcome.
- **Actors:** Primary: Developer. Supporting: Squad PM and technical reviewer
- **Trigger:** Submit completion evidence.
- **Preconditions:** Task IN_PROGRESS and classified non-code; tasks.submit grant.
- **Main flow:** 1. Submit completion evidence. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall accept the deliverable-specific evidence and route it to PM review. 4. Work awaits review with evidence retained.
- **Alternative flow:** For a code deliverable, use UC-DEV-003 with Git evidence.
- **Exceptions:** Missing relevant evidence, non-assignee, wrong state or no grant: reject.
- **Postconditions:** Work awaits review with evidence retained.
- **Business rules:** BR-007, BR-011; non-code evidence is PLANNED.
- **Related requirement IDs:** `FR-DEV-004`
- **Implementation status:** PLANNED — owner decision; current implementation requires Git proof for all tasks.
- **Permission/evidence:** `tasks.submit`; target grant/scope policy. Evidence: `docs/srs/DECISIONS.md:13`; `src/modules/tasks/tasks.service.ts:507–545`; FR-SYS-014.
