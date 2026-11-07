# Developer perspective requirements

**Draft, 2026-11-07.** This perspective uses attribute-based access control (ABAC): an operation requires an explicit service/action grant and resource-scope predicates. Job titles describe responsibilities and do not themselves grant access. Current source still uses fixed role guards, so a requirement whose business operation exists but whose service grant does not is **PARTIAL**. Source-level routes and scopes are evidence, not approved target entitlements. Shared identity, task state, ledger, audit and cross-cutting controls are specified once in [common-srs.md](common-srs.md); current access evidence is in [rbac-matrix.md](../access/rbac-matrix.md). Priorities are TBD. No deployment behavior was exercised.

## Objectives, interfaces and scope

The Developer perspective covers assigned task execution, cross-squad bounty reporting and technical-service participation. Current interfaces also expose own dashboard, wallet, certification history, notices and some broad authenticated lists (`docs/srs/access/rbac-matrix.md`; `src/modules/dashboard/dashboard.controller.ts:15–52`). Those shared reads are defined by common SRS and need per-service visibility policy; the job title alone grants none. Task completion proof follows owner decision DEC-08.

## Other current worker interfaces

| Interface / operation | Source evidence and current access | Target service grant |
|---|---|---|
| Own dashboard, wallet, profile, notices | Shared authenticated/self routes (`src/modules/dashboard/dashboard.controller.ts:15–19`; `src/modules/ledger/ledger.controller.ts:165–185`; `src/modules/users/users.controller.ts:101–123`; `src/modules/notices/notices.controller.ts:75–190`). | Shared SRS applies; per-service reads and notice grants **UNVERIFIED**. |
| Marketplace listing creation and consultant/certification lists | Authenticated routes; listing creation requires certification (`src/modules/marketplace/marketplace.controller.ts:39–47`; `src/modules/marketplace/marketplace.service.ts:24–38`; `src/modules/certifications/certifications.controller.ts:57–70`). | **UNVERIFIED** target grants and read scopes. |
| Clients, bounty reports, bookings, citations | Current broad authenticated reads (`src/modules/clients/clients.controller.ts:76–89`; `src/modules/bounty/bounty.controller.ts:98–103`; `src/modules/consultancy/consultancy.controller.ts:43–51`; `src/modules/audit/audit.controller.ts:47–65`). | Organization-wide visibility is not approved; scope **UNVERIFIED**. |

## Functional requirements

Each requirement contains one acceptance obligation. The *related permission* is a proposed service/action name for the target policy, not an existing permission record. A requirement marked PARTIAL has the cited business operation in source but no ABAC enforcement. Unspecified grants remain **UNVERIFIED** and are denied by the target default policy.

### FR-DEV-001 — Read assigned tasks

| Field | Requirement detail |
|---|---|
| ID | `FR-DEV-001` |
| Name | Read assigned tasks |
| Description | See work within active squad/assignment scope. |
| Actor | Worker |
| Preconditions | Authenticated and tasks.read grant; active assignment or squad scope. |
| Trigger | Open task list/detail. |
| System behavior | The system shall return only tasks in the worker’s authorized scope. |
| Postconditions | Task data displayed without mutation. |
| Exceptions | No grant, inaccessible task or missing task: deny/filter. |
| Related permission | `tasks.read`; target grant/scope policy. |
| Implementation status | **PARTIAL — current squad-scoped read exists, service grant absent.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:135–159`; `src/modules/tasks/tasks.service.ts:413–480`. |

### FR-DEV-002 — Start assigned task

| Field | Requirement detail |
|---|---|
| ID | `FR-DEV-002` |
| Name | Start assigned task |
| Description | Move assigned planned work to in progress. |
| Actor | Assigned worker |
| Preconditions | Task TODO, assignment and tasks.start grant. |
| Trigger | Start work. |
| System behavior | The system shall check assignment and state, then record IN_PROGRESS transition. |
| Postconditions | Task in progress with actor/time. |
| Exceptions | Wrong state, lockout, non-assignee or no grant: reject. |
| Related permission | `tasks.start`; target grant/scope policy. |
| Implementation status | **PARTIAL — current assigned start exists, service grant absent.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:166–171`; `src/modules/tasks/tasks.service.ts:487–505`; WF-03. |

### FR-DEV-003 — Submit code task evidence

| Field | Requirement detail |
|---|---|
| ID | `FR-DEV-003` |
| Name | Submit code task evidence |
| Description | Flag assigned code work complete with Git proof. |
| Actor | Assigned worker |
| Preconditions | Task IN_PROGRESS, assignment, tasks.submit grant. |
| Trigger | Flag complete. |
| System behavior | The system shall validate a PR URL or 7–40 hexadecimal commit hash and record FLAGGED_COMPLETE. |
| Postconditions | Work awaits PM review. |
| Exceptions | Missing/invalid proof, wrong state, lockout, non-assignee or no grant: reject. |
| Related permission | `tasks.submit`; target grant/scope policy. |
| Implementation status | **PARTIAL — current Git validation exists; service grant absent.** |
| Evidence | `src/modules/tasks/tasks.controller.ts:173–180`; `src/modules/tasks/tasks.service.ts:507–545`; WF-03. |

### FR-DEV-004 — Submit non-code task evidence

| Field | Requirement detail |
|---|---|
| ID | `FR-DEV-004` |
| Name | Submit non-code task evidence |
| Description | Flag assigned non-code work with a relevant artifact, link or written outcome. |
| Actor | Assigned worker |
| Preconditions | Task IN_PROGRESS and classified non-code; tasks.submit grant. |
| Trigger | Submit completion evidence. |
| System behavior | The system shall accept the deliverable-specific evidence and route it to PM review. |
| Postconditions | Work awaits review with evidence retained. |
| Exceptions | Missing relevant evidence, non-assignee, wrong state or no grant: reject. |
| Related permission | `tasks.submit`; target grant/scope policy. |
| Implementation status | **PLANNED — owner decision; current implementation requires Git proof for all tasks.** |
| Evidence | `docs/srs/DECISIONS.md:13`; `src/modules/tasks/tasks.service.ts:507–545`; FR-SYS-014. |

### FR-DEV-005 — Report cross-squad defect

| Field | Requirement detail |
|---|---|
| ID | `FR-DEV-005` |
| Name | Report cross-squad defect |
| Description | Submit a bounty report against another squad. |
| Actor | Assigned worker |
| Preconditions | Active squad membership, eligible target, bounty.report grant. |
| Trigger | Submit report. |
| System behavior | The system shall validate cross-squad target and cooldown/cap before recording the report. |
| Postconditions | Report awaits technical triage. |
| Exceptions | Same squad, inactive membership, cooldown/cap or no grant: reject. |
| Related permission | `bounty.report`; target grant/scope policy. |
| Implementation status | **PARTIAL — Developer route exists, service grant absent.** |
| Evidence | `src/modules/bounty/bounty.controller.ts:91–96`; `src/modules/bounty/bounty.service.ts:87–134`. |

### FR-DEV-006 — Apply for technical certification

| Field | Requirement detail |
|---|---|
| ID | `FR-DEV-006` |
| Name | Apply for technical certification |
| Description | Request provider certification. |
| Actor | Worker |
| Preconditions | Authenticated and certifications.apply grant. |
| Trigger | Submit application. |
| System behavior | The system shall validate cooldown and create a pending application. |
| Postconditions | CTO review pending. |
| Exceptions | Cooldown, invalid application or no grant: reject. |
| Related permission | `certifications.apply`; target grant/scope policy. |
| Implementation status | **PARTIAL — authenticated route exists, service grant absent.** |
| Evidence | `src/modules/certifications/certifications.controller.ts:44–48`; `src/modules/certifications/certifications.service.ts:19–53`; WF-10. |

### FR-DEV-007 — Complete assigned consultancy

| Field | Requirement detail |
|---|---|
| ID | `FR-DEV-007` |
| Name | Complete assigned consultancy |
| Description | Submit deliverable for a booking assigned to the worker. |
| Actor | Assigned consultant |
| Preconditions | Booking scheduled, consultant assignment and consultancy.complete grant. |
| Trigger | Submit completion. |
| System behavior | The system shall require at least 50 words of notes and an actionable PR/repository link, release escrow and mark booking completed. |
| Postconditions | Booking completed; payout recorded. |
| Exceptions | Unassigned consultant, invalid evidence, wrong state or no grant: reject. |
| Related permission | `consultancy.complete`; target grant/scope policy. |
| Implementation status | **PARTIAL — Developer route/assignment check exists, service grant absent.** |
| Evidence | `src/modules/consultancy/consultancy.controller.ts:47–55`; `src/modules/consultancy/consultancy.service.ts:96–139`; WF-10. |


## Workflow, data and dependencies

WF-03: PM assigns work; Developer starts and submits evidence; PM then CTO review. WF-10: worker applies for certification and may complete a consultancy booking when assigned. Bounty reporting depends on active squad membership and CTO triage. Inputs are task IDs/evidence, bounty report and certification/consultancy data; outputs are transitions and review queues.

## Errors, audit and unresolved decisions

Current task transition audit records actor and time (`src/modules/tasks/tasks.service.ts:42–69`). Target service decisions should also log denied access and sensitive submissions; retention and format remain TBD. Resolve non-code evidence schema/validation, visibility of broad lists, whether a certified Developer can create marketplace listings under a service grant, and cancellation/reversal paths for partially completed consultancy payments.
