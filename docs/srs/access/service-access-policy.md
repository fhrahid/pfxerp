# Target attribute-based access policy

**Status: PLANNED target policy; UNVERIFIED grant scopes and deployed behavior.** DEC-03 now names the target attribute-based access control (ABAC). The earlier service/action grant decision remains part of the policy: the CEO assigns explicit entitlements to individual people, and a job-role label does not supply one. [rbac-matrix.md](rbac-matrix.md) records current `@Roles` and service behavior (`src/common/guards/roles.guard.ts:15–33`; `prisma/schema.prisma:237–250`); it is not a target grant template. The ABAC terminology follows [NIST SP 800-162](https://csrc.nist.gov/pubs/sp/800/162/upd2/final).

## Decision rule

For each protected request, evaluate these inputs against the policy:

| Input | Target meaning |
|---|---|
| Subject | Authenticated person, active account, direct CEO-managed service/action grants, and relevant active squad relationships. Descriptive CHRO/CPO/CTO/CFO/PM/Developer labels are available for display and audit but confer no access by themselves. |
| Action | The specific service operation, such as `payroll.approve` or `tasks.read`. A read, export, approval and execution are distinct operations. |
| Resource | Record type and identity, owner/assignee/squad relationship, classification and current workflow state where applicable. |
| Context | Request time and channel, authenticated session, prior actor identities for maker/checker rules, and any approved emergency condition. The exact conditions remain **UNVERIFIED**. |

**PLANNED rule:** allow only if a matching active direct grant exists, the requested resource falls within that grant's approved scope, and every applicable state and conflict predicate passes. Missing, stale, revoked or unknown grant/scope/attribute/policy data denies the request. A matching grant alone cannot bypass a business-state or segregation-of-duties rule. The CEO's current route-level bypass is source behavior, not target authority. A person holding several job labels gains no union of permissions from those labels.

Each future grant needs a person, service/action, approved resource scope, effective and revoked state, granting actor and timestamps. The exact schema, approved scope values, grant expiry/delegation, CEO self-grant and emergency exception remain **UNVERIFIED**. The initial `access.grants.manage` entitlement needs an approved bootstrap procedure; the CEO label cannot create that entitlement by itself. A grant change must be auditable; the policy must reevaluate active grant and relationship state for protected requests so a revoked entitlement or ended squad membership cannot authorize later access. `FR-SYS-036`–`038` specify grant assignment, revocation and audit. The source has no general grant store or ABAC decision point (`prisma/schema.prisma:237–250`, `:1042–1052`; `src/common/guards/roles.guard.ts:15–33`).

The decision point must cover API operations, reads and list filters, Socket.IO room joins and event delivery, and background actions that read or mutate protected records. The action's resource scope must also constrain returned rows and fields; checking only the endpoint is insufficient for a broad list. Policy checks cannot substitute for transaction-level business checks where state may change before a financial or approval write. Exact enforcement architecture and caching are design choices, but stale cached grants must not keep a revoked permission effective.

## Candidate service actions from the perspective requirements

The names below are **PROPOSED** target action identifiers, not existing permissions or automatic grants to people with the named job title.

| Service | Candidate actions | Resource condition and policy state | Trace |
|---|---|---|---|
| Authorization | `access.grants.manage`, `access.grants.read` | CEO directly assigns/revokes grants; subject, action, scope and audit are required. CEO self-grant and independent review are **UNVERIFIED**. | `docs/srs/DECISIONS.md` DEC-03; `FR-SYS-036`–`038` |
| Payroll | `payroll.read`, `payroll.submit`, `payroll.approve`, `payroll.execute` | PM submission is current own-squad behavior; CHRO approval is owner-planned; review visibility, executor and rejection authority **UNVERIFIED**. | `src/modules/payroll/payroll.service.ts:125–327`; `docs/srs/access/HANDOFF.md` |
| Tasks | `tasks.read`, `tasks.create`, `tasks.start`, `tasks.submit`, `tasks.review.pmApprove`, `tasks.review.pmReject`, `tasks.review.read`, `tasks.review.approve`, `tasks.review.reject`, `tasks.close` | Assignment, active squad, transition state and self-review/conflict checks apply. | `src/modules/tasks/tasks.service.ts:226–718` |
| Technical services | `certifications.apply`, `certifications.review`, `bounty.report`, `bounty.triage`, `marketplace.verify`, `consultancy.book`, `consultancy.complete`, `audit.citation.create` | Pending application/report/listing/booking states and assigned squad or consultant scope apply; other actions need decisions. | `src/modules/certifications/certifications.service.ts:19–109`; `src/modules/bounty/bounty.service.ts:87–241`; `src/modules/marketplace/marketplace.service.ts:128–143`; `src/modules/consultancy/consultancy.service.ts:26–166`; `src/modules/audit/audit.service.ts:20–91` |
| Finance | `ledger.allocate`, `ledger.allocatePersonal`, `ledger.returnFunds`, `poolFunding.request`, `fines.approve`, `sprintPayouts.submit`, `sprintPayouts.execute`, `loans.apply`, `loans.repay`, `loans.disburse`, `equity.invest` | Account state, balance, idempotency, CEO approval, squad relationship and maker/checker conditions apply. CEO route bypass is current behavior, not a target grant. | `src/modules/ledger/ledger.controller.ts:92–209`; `src/modules/sprint-payouts/sprint-payouts.service.ts:24–190`; `src/modules/loans/loans.service.ts:24–195`; `src/modules/equity/equity.service.ts:19–75` |
| Clients and squads | `clients.audit`, `clients.acceptInternal`, `squads.repositories.manage` | Milestone state, assigned squad and active PM membership apply. Internal acceptance is not external-client approval. | `src/modules/clients/clients.service.ts:131–231`; `src/modules/squads/squads.service.ts:188–278` |

## Enforcement and audit boundaries

For sensitive decisions, retain actor, action, resource, outcome, time, matching grant/policy version and transaction or transition reference where applicable. `FR-SYS-038` requires grant-change audit. Denied-attempt logging, retention, audit visibility and failure policy for other business actions are **PROPOSED/TBD** pending security policy. Current task transitions and ledger postings have audit evidence, while user-change audit can fail without blocking the change (`src/modules/tasks/tasks.service.ts:42–69`; `src/modules/ledger/ledger.service.ts:46–183`; `src/modules/users/users.service.ts:168–199`).

**Business decisions still required:** initial grant-administrator bootstrap and recovery; approved scope for each service read/export and grant; CHRO payroll reject/execute separation; CEO self-grant/emergency override; and maker/checker conflicts across multiple job labels. Until answered, no grant or exception is implied. See [authorization-gaps.md](authorization-gaps.md) and the perspective documents.
