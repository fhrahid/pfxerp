# Architectural & Implementation Decision Log (`decesion.md`)

This log tracks architectural, security, and implementation decisions made in the Pointfex ERP codebase.

---

## ADR-001: Local Git Branch Merge & History Alignment
- **Date**: 2026-11-02
- **Context**: The local `main` branch contained 7 unpushed commits authored by `naim`, while upstream `origin/main` had advanced by 2 commits (`0f7c3e1` and `21adfac`). Branch `naim` needed to incorporate upstream changes without losing any local work or causing conflicts.
- **Decision**:
  1. Stashed unstaged working directory changes ([`.gitignore`](file:///home/naim/Codebase/Projects/pfxerp/.gitignore), [`src/modules/tasks/tasks.service.ts`](file:///home/naim/Codebase/Projects/pfxerp/src/modules/tasks/tasks.service.ts)).
  2. Pointed local `main` to track upstream `origin/main` (`21adfac`).
  3. Merged `main` into branch `naim` creating merge commit `1a7ba79` (0 conflicts across 10 files).
  4. Restored uncommitted changes from stash.
- **Status**: Implemented & Verified.

---

## ADR-002: Strict Southeast University (`@seu.edu.bd`) Authentication Domain
- **Date**: 2026-11-02
- **Context**: Pointfex ERP serves Southeast University (CSE474). Authentication and user creation needed to be restricted to institutional emails.
- **Decision**:
  1. Enforced strict domain check: only email addresses ending in `@seu.edu.bd` are permitted to authenticate or register.
  2. **No Subdomains**: Explicitly disallowed subdomains (e.g., `@cse.seu.edu.bd`) per requirement; pattern is strictly `/^[a-zA-Z0-9._%+-]+@seu\.edu\.bd$/`.
  3. **No Demo Account Bypass**: Removed `ALLOW_DEMO_ACCOUNTS` and `@pointfex.dev` exceptions.
  4. **Email Normalization**: All input emails are trimmed and lowercased before validation and database queries.
  5. **Case-Insensitive Resolution**: Used `mode: 'insensitive'` in Prisma queries to prevent login failures from mobile auto-capitalization (`Noor@SEU.EDU.BD`).
  6. **Prevent User Enumeration**: Returns generic `AUTH_INVALID_CREDENTIALS` (HTTP 401) for both non-existent emails and wrong passwords.
  7. **Enforced in User Provisioning**: [`UsersService.createUser`](file:///home/naim/Codebase/Projects/pfxerp/src/modules/users/users.service.ts) and `updateUser` validate the domain so new accounts cannot be provisioned outside `@seu.edu.bd`.
  8. **Frontend UX**: Updated [`public/app.js`](file:///home/naim/Codebase/Projects/pfxerp/public/app.js) placeholders and added client-side validation for instant feedback.
- **Status**: Implemented & Verified (19/19 audit tests passing in [`scripts/security-audit-test.mjs`](file:///home/naim/Codebase/Projects/pfxerp/scripts/security-audit-test.mjs)).

---

## ADR-003: Vulnerability & Exploit Defense Standards
- **Date**: 2026-11-02
- **Context**: Ensuring robust protection against standard web application attack vectors on authentication endpoints.
- **Decision**:
  1. **ReDoS**: Linear O(n) regex without nested quantifiers or overlapping groups prevents catastrophic backtracking.
  2. **Injection Defense**: Database queries strictly use Prisma ORM parameterized statements, preventing SQL injection in both email and password parameters.
  3. **Null Byte & Domain Spoofing**: Exact anchoring (`^...$`) and dot-escaping (`\.`) prevent suffix injection (e.g., `user@seu.edu.bd.evil.com`) and null-byte bypasses (`\0`).
  4. **Token Security**: Retained bcrypt SHA-256 pre-hashing for refresh tokens with rotation and reuse detection (replaying revoked refresh tokens invalidates the entire session family).
- **Status**: Implemented & Verified.

---

## ADR-004: Docker Container Build vs. Restart Protocol
- **Date**: 2026-11-02
- **Context**: The Docker setup compiles the NestJS application during image build (`RUN npm run build` in `Dockerfile`). Running `docker compose restart api` only reboots the container using the existing cached image and does not pick up local file changes.
- **Decision**: Documented that deployments and local Docker updates must use `docker compose up -d --build api` to compile and apply source updates.
- **Status**: Documented.

---

## ADR-005: 72-Hour C-Level Developer Invitation & Token Architecture
- **Date**: 2026-11-02
- **Context**: Developer onboarding requires strict role-based authorization where only C-Level executives (CEO, CFO, CTO, CPO) can dispatch invitations to prospective developers with fixed 72-hour validity windows.
- **Decision**:
  1. **Strict C-Level RBAC**: Endpoints under `/api/v1/invitations` are guarded by `RolesGuard` and `@Roles(CEO, CFO, CTO, CPO)`, with programmatic defense-in-depth checks inside `InvitationsService`.
  2. **SHA-256 Token Pre-Hashing**: Invitation links carry high-entropy 32-byte (256-bit) cryptographically secure random tokens. Only the SHA-256 hash digest is persisted in the PostgreSQL database, ensuring database compromise cannot expose usable invitation links.
  3. **72-Hour Expiration Boundary**: Invitations store an immutable `expiresAt` timestamp set to exactly 72 hours from issuance. Expired invitations are marked `EXPIRED` and rejected.
  4. **Replay & Single-Use Protection**: Consumed invitations are immediately marked `ACCEPTED` with `acceptedAt` timestamp in an atomic database transaction. Any replay attempts are rejected.
  5. **Auto-Provisioning**: Accepting an invitation creates the user, hashes their password with bcrypt (12 rounds), auto-provisions their initial `PERSONAL_WALLET` (BDT 0.00), optionally attaches squad memberships, and immediately issues JWT access/refresh token pairs.
  6. **Resend Protocol**: Leadership can re-issue invitations, which invalidates prior tokens and initiates a fresh 72-hour window.
- **Status**: Implemented & Verified.

---

## ADR-006: Resend Email Delivery Engine & Password Reset Protocol
- **Date**: 2026-11-02
- **Context**: Transactional email delivery is required for sending developer invitation links and self-service password reset links.
- **Decision**:
  1. **Resend Provider Integration**: Integrated the official `resend` SDK into `MailService` for transactional email delivery.
  2. **Zero-Configuration Dev/Test Fallback**: If `RESEND_API_KEY` is omitted or contains a placeholder, `MailService` operates in a safe simulated logger mode, logging dispatched URLs to standard out and storing in-memory audit history for verification tests without crashing or blocking local pipelines.
  3. **User Enumeration Defense**: `AuthService.forgotPassword` returns an identical success message regardless of whether the submitted email address is registered or exists in the database.
  4. **Session Revocation on Reset**: Completing a password reset automatically sets `user.refreshTokenHash = null`, invalidating all active refresh sessions across all devices for security hygiene.
- **Status**: Implemented & Verified.

---

## ADR-007: Dynamic Role Creation & Hierarchical Role Assignment Architecture
- **Date**: 2026-11-02
- **Context**: The studio requires flexible organizational growth where the CEO can create new organizational and executive roles (e.g. `CHRO`, `QA_LEAD`, `DEVOPS`, `DESIGNER`) dynamically at runtime, while strictly maintaining hierarchical privilege separation so that non-CEO C-level officers cannot escalate privileges or create executive peers.
- **Decision**:
  1. **Dynamic Role Entity**: Introduced `model Role` in PostgreSQL storing `name` (`VARCHAR(50)`), `description`, and `isSystem` boolean flag. System roles (`CEO`, `CFO`, `CTO`, `CPO`, `PM`, `DEVELOPER`) are pre-seeded with `isSystem = true`.
  2. **CEO-Only Creation Gate**: `POST /roles` is guarded by `@Roles(UserRole.CEO)` and validated in `RolesService.createRole()`. Role names are sanitized with `/^[A-Z0-9_]{2,30}$/`, and case-insensitive duplicates are rejected with HTTP 409 `CONFLICT`.
  3. **Hierarchical Invitation Constraints**:
     - When the **CEO** sends an invitation, any system role or custom role created by the CEO can be selected.
     - When **other C-Level officers** (CFO, CTO, CPO) send an invitation, they are strictly restricted to `DEVELOPER` and `PM` roles. Attempts to invite executive or custom roles throw HTTP 403 `AUTHZ_FORBIDDEN`.
  4. **Dynamic Schema Alignment**: `User.role` and `Invitation.role` store `VARCHAR(50)`, decoupling runtime role creation from static compiled enum limitations while preserving full type compatibility.
  5. **Dynamic UI Dropdowns**: The frontend console fetches `/roles` dynamically: CEO sees all system + custom roles with "+ New Role" modal access; non-CEO C-level views strictly `DEVELOPER` and `PM`.
- **Status**: Implemented & Verified.


