# Identity use case descriptions

**Draft, 2026-11-07.** Actor associations describe current RBAC where stated; target service/action grants are separate and mostly not implemented. A listed supporting actor is a collaborator or decision maker, never an automatic permission grant. Source references are in each case.

## UC-SYS-001 — Sign in
- **ID:** `UC-SYS-001`
- **Name:** Sign in
- **Goal:** Obtain an access session
- **Actors:** Primary: Account holder. Supporting: None required by this use case.
- **Trigger:** User submits credentials.
- **Preconditions:** Eligible active account and allowed-domain email.
- **Main flow:** 1. User submits credentials. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall validate email/password and issue session tokens. 4. Access session issued.
- **Alternative flow:** A valid refresh token can be rotated by the client as a separate automatic step.
- **Exceptions:** Invalid credentials or inactive user: deny.
- **Postconditions:** Access session issued.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-001`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/auth/auth.controller.ts:53–81`; `src/modules/auth/auth.service.ts:51–153`.

## UC-SYS-002 — Change own password
- **ID:** `UC-SYS-002`
- **Name:** Change own password
- **Goal:** Replace own secret
- **Actors:** Primary: Authenticated user. Supporting: None required by this use case.
- **Trigger:** User submits old and new passwords.
- **Preconditions:** Valid current session.
- **Main flow:** 1. User submits old and new passwords. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall verify current password and replace it with an allowed new password. 4. New password stored.
- **Alternative flow:** User may use password reset instead when current password is unavailable.
- **Exceptions:** Wrong current password or short new password: reject.
- **Postconditions:** New password stored.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-003`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/auth/auth.controller.ts:83–87`; `src/modules/auth/auth.service.ts:156–167`.

## UC-SYS-003 — Reset password
- **ID:** `UC-SYS-003`
- **Name:** Reset password
- **Goal:** Recover account access
- **Actors:** Primary: Account holder. Supporting: None required by this use case.
- **Trigger:** User requests reset and submits token/new password.
- **Preconditions:** Eligible account and valid single-use token at completion.
- **Main flow:** 1. User requests reset and submits token/new password. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall issue an expiring reset token and consume it on successful password replacement. 4. Password replaced and token consumed.
- **Alternative flow:** The request may use simulated mail when the mail service is not configured.
- **Exceptions:** Invalid, expired or reused token: reject.
- **Postconditions:** Password replaced and token consumed.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-004`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/auth/auth.service.ts:170–291`; `src/modules/mail/mail.service.ts:33–85`.

## UC-SYS-004 — Accept invitation
- **ID:** `UC-SYS-004`
- **Name:** Accept invitation
- **Goal:** Join the organization
- **Actors:** Primary: Invitee. Supporting: None required by this use case.
- **Trigger:** Invitee submits invitation token and account details.
- **Preconditions:** Unexpired, unused invitation.
- **Main flow:** 1. Invitee submits invitation token and account details. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall create user, personal wallet and optional preassigned squad membership transactionally. 4. Invitee has an account.
- **Alternative flow:** Invitation may omit squad assignment.
- **Exceptions:** Expired/used token or invalid input: reject without partial enrollment.
- **Postconditions:** Invitee has an account.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-005`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/invitations/invitations.controller.ts:49–59`; `src/modules/invitations/invitations.service.ts:322–430`.

## UC-SYS-005 — Assign descriptive job label
- **ID:** `UC-SYS-005`
- **Name:** Assign descriptive job label
- **Goal:** Record a person’s job labels
- **Actors:** Primary: CEO. Supporting: None required by this use case.
- **Trigger:** CEO assigns or revokes a label.
- **Preconditions:** Target person and label exist; service grant model remains separate.
- **Main flow:** 1. CEO assigns or revokes a label. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall store multiple active labels and an actor/time audit of each assignment or revocation. 4. Job-label record changes without implied service access.
- **Alternative flow:** CEO may revoke a label without revoking an independent service grant; revocation coupling is TBD.
- **Exceptions:** Invalid target or unauthorized actor: reject; migration from one role field is unresolved.
- **Postconditions:** Job-label record changes without implied service access.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-006`, `FR-SYS-007`
- **Implementation status:** PLANNED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `docs/srs/DECISIONS.md:7–9`; current `prisma/schema.prisma:237–250`; `src/modules/roles/roles.service.ts:70–102`.

## UC-SYS-006 — Maintain squad membership
- **ID:** `UC-SYS-006`
- **Name:** Maintain squad membership
- **Goal:** Assign or transfer squad membership
- **Actors:** Primary: Authorized organization manager. Supporting: None required by this use case.
- **Trigger:** Manager selects person and squad.
- **Preconditions:** Authorized current CPO/CEO route; target service grant TBD.
- **Main flow:** 1. Manager selects person and squad. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall create, change, remove or transfer membership subject to source allocation rules. 4. Active/historical membership updated.
- **Alternative flow:** Transfer is an alternative to remove then add and may incur swap fee.
- **Exceptions:** Allocation cap, invalid squad/person or no current authority: reject.
- **Postconditions:** Active/historical membership updated.
- **Business rules:** The cited requirement and current service state/validation rules apply.
- **Related requirement IDs:** `FR-SYS-009`
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/squads/squads.controller.ts:87–175`; `src/modules/squads/squads.service.ts:357–523`.

## UC-SYS-034 — Manage direct service grants
- **ID:** `UC-SYS-034`
- **Name:** Manage direct service grants
- **Goal:** Assign or revoke a person's service/action entitlement within an approved resource scope.
- **Actors:** Primary: CEO. Supporting: Grant recipient.
- **Trigger:** CEO submits a grant assignment or revocation.
- **Preconditions:** Authenticated CEO with active `access.grants.manage` entitlement; target person and action exist; requested scope has been approved in the policy catalog. Initial grant-administrator bootstrap remains UNVERIFIED.
- **Main flow:** 1. CEO selects a person, service/action and scope. 2. The system validates the CEO's administration authority and the requested scope. 3. The system assigns or revokes the direct grant and records actor, subject, action, scope and time. 4. Subsequent protected requests use the current active grant state.
- **Alternative flow:** Revocation removes the entitlement without changing the person's descriptive job labels.
- **Exceptions:** Unknown person/action/scope or unauthorized actor: deny without changing grants. CEO self-grant and emergency rules remain UNVERIFIED.
- **Postconditions:** Grant state and change audit agree; job labels are unchanged.
- **Business rules:** DEC-03; the ABAC decision in FR-SYS-008 still checks resource, state and context after a grant matches.
- **Related requirement IDs:** `FR-SYS-036`, `FR-SYS-037`, `FR-SYS-038`
- **Implementation status:** PLANNED — owner-selected direct grants; no current grant store or policy decision point.
- **Permission/evidence:** `access.grants.manage` is a proposed administration action, not an existing permission. Evidence: `docs/srs/DECISIONS.md` DEC-03; `docs/srs/access/service-access-policy.md`; current contrast `src/common/guards/roles.guard.ts:15–33`.

## UC-SYS-021 — Invite worker
- **ID:** `UC-SYS-021`
- **Name:** Invite worker
- **Goal:** Start enrollment
- **Actors:** Primary: Current CEO/CFO/CTO/CPO. Supporting: None required by this use case.
- **Trigger:** Executive creates invitation.
- **Preconditions:** Current role gate; invitee email and requested role valid.
- **Main flow:** 1. Executive creates invitation. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall create an invitation and send or simulate delivery. 4. Pending invitation exists.
- **Alternative flow:** Non-CEO inviter is limited to PM/Developer role; CEO may choose any existing role.
- **Exceptions:** Duplicate/invalid invitee or unauthorized requested role: reject.
- **Postconditions:** Pending invitation exists.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/invitations/invitations.controller.ts:15–20`; `src/modules/invitations/invitations.service.ts:28–133`.

## UC-SYS-027 — Manage own user profile
- **ID:** `UC-SYS-027`
- **Name:** Manage own user profile
- **Goal:** View or edit permitted personal details
- **Actors:** Primary: Authenticated user. Supporting: None required by this use case.
- **Trigger:** User opens or updates own profile.
- **Preconditions:** Authenticated; current route and profile scope.
- **Main flow:** 1. User opens or updates own profile. 2. The system checks the stated preconditions and the applicable current access rule or target service grant and resource scope. 3. The system shall return or update only the fields allowed by the current user service. 4. Profile data returned or updated.
- **Alternative flow:** Executive roster/administrative edits are separate current capabilities with target grants TBD.
- **Exceptions:** Forbidden target or invalid data: reject.
- **Postconditions:** Profile data returned or updated.
- **Business rules:** Current source validation applies; no dedicated SRS functional ID exists yet.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/users/users.controller.ts:70–137`; `src/modules/users/users.service.ts:46–199`.

## UC-SYS-031 — Manage worker account
- **ID:** `UC-SYS-031`
- **Name:** Manage worker account
- **Goal:** Create or update a worker account.
- **Actors:** Primary: Current CPO/CEO. Supporting: None required by this use case.
- **Trigger:** Authorized executive submits account change.
- **Preconditions:** Current CPO/CEO role check; valid target account data.
- **Main flow:** 1. Authorized executive submits account change. 2. The system checks the stated preconditions and current access rule; target service grant and scope remain undecided. 3. The system shall apply current CPO restrictions on non-executive accounts and CEO broader account powers. 4. Account record changes.
- **Alternative flow:** CPO/CHRO target division is UNVERIFIED; no CHRO access inferred.
- **Exceptions:** Forbidden executive/peer edit, invalid role or invalid input: reject.
- **Postconditions:** Account record changes.
- **Business rules:** Current user restrictions apply; privileged audit can fail without blocking update.
- **Related requirement IDs:** None allocated; source-observed supporting use case.
- **Implementation status:** IMPLEMENTED as a current source operation; target ABAC grant UNVERIFIED.
- **Permission/evidence:** Current RBAC matrix applies; target service grant is UNVERIFIED. Evidence: `src/modules/users/users.controller.ts:91–137`; `src/modules/users/users.service.ts:46–199`.
