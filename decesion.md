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

