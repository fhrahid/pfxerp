# Coverage checklist

Static audit snapshot: 2026-11-07. Check marks mean the handwritten file was included in the repository inventory and batch review; behavioral claims in the other audit files have targeted source citations. Scripts were reviewed for their role as support/verification code and do not prove deployed behavior. No application or test commands were run.

## Included files

### Root configuration and documentation (11)

- [x] `.dockerignore`
- [x] `.env.example`
- [x] `.gitignore`
- [x] `DEPLOY.md`
- [x] `Dockerfile`
- [x] `README.md`
- [x] `decesion.md`
- [x] `docker-compose.yml`
- [x] `package.json`
- [x] `skills-lock.json`
- [x] `tsconfig.json`

### Prisma and migrations (5)

- [x] `prisma/migrations/20261102000000_initial/migration.sql`
- [x] `prisma/migrations/20261107000000_align_schema/migration.sql`
- [x] `prisma/migrations/migration_lock.toml`
- [x] `prisma/schema.prisma`
- [x] `prisma/seed.ts`

### Backend and shared runtime (93)

- [x] `src/app.module.ts`
- [x] `src/common/constants/error-codes.ts`
- [x] `src/common/crypto/e2ee.util.ts`
- [x] `src/common/decorators/index.ts`
- [x] `src/common/dto/pagination.dto.ts`
- [x] `src/common/exceptions/app.exception.ts`
- [x] `src/common/filters/http-exception.filter.ts`
- [x] `src/common/guards/jwt-auth.guard.ts`
- [x] `src/common/guards/roles.guard.ts`
- [x] `src/common/interceptors/transform.interceptor.ts`
- [x] `src/common/middleware/http-logger.middleware.ts`
- [x] `src/common/types.ts`
- [x] `src/env.ts`
- [x] `src/events/events.gateway.ts`
- [x] `src/events/events.module.ts`
- [x] `src/main.ts`
- [x] `src/modules/audit/audit.controller.ts`
- [x] `src/modules/audit/audit.module.ts`
- [x] `src/modules/audit/audit.service.ts`
- [x] `src/modules/audit/executive-audit.controller.ts`
- [x] `src/modules/auth/auth.controller.ts`
- [x] `src/modules/auth/auth.module.ts`
- [x] `src/modules/auth/auth.service.ts`
- [x] `src/modules/auth/jwt.strategy.ts`
- [x] `src/modules/bounty/bounty.controller.ts`
- [x] `src/modules/bounty/bounty.module.ts`
- [x] `src/modules/bounty/bounty.service.ts`
- [x] `src/modules/certifications/certifications.controller.ts`
- [x] `src/modules/certifications/certifications.module.ts`
- [x] `src/modules/certifications/certifications.service.ts`
- [x] `src/modules/chaos/chaos.controller.ts`
- [x] `src/modules/chaos/chaos.module.ts`
- [x] `src/modules/chaos/chaos.service.ts`
- [x] `src/modules/clients/clients.controller.ts`
- [x] `src/modules/clients/clients.module.ts`
- [x] `src/modules/clients/clients.service.ts`
- [x] `src/modules/consultancy/consultancy.controller.ts`
- [x] `src/modules/consultancy/consultancy.module.ts`
- [x] `src/modules/consultancy/consultancy.service.ts`
- [x] `src/modules/dashboard/dashboard.controller.ts`
- [x] `src/modules/dashboard/dashboard.module.ts`
- [x] `src/modules/dashboard/dashboard.service.ts`
- [x] `src/modules/equity/equity.controller.ts`
- [x] `src/modules/equity/equity.module.ts`
- [x] `src/modules/equity/equity.service.ts`
- [x] `src/modules/governance/governance.controller.ts`
- [x] `src/modules/governance/governance.module.ts`
- [x] `src/modules/governance/governance.service.ts`
- [x] `src/modules/invitations/dto/accept-invitation.dto.ts`
- [x] `src/modules/invitations/dto/create-invitation.dto.ts`
- [x] `src/modules/invitations/invitations.controller.ts`
- [x] `src/modules/invitations/invitations.module.ts`
- [x] `src/modules/invitations/invitations.service.ts`
- [x] `src/modules/ledger/ledger.controller.ts`
- [x] `src/modules/ledger/ledger.module.ts`
- [x] `src/modules/ledger/ledger.service.ts`
- [x] `src/modules/loans/loans.controller.ts`
- [x] `src/modules/loans/loans.module.ts`
- [x] `src/modules/loans/loans.service.ts`
- [x] `src/modules/mail/mail.module.ts`
- [x] `src/modules/mail/mail.service.ts`
- [x] `src/modules/marketplace/marketplace.controller.ts`
- [x] `src/modules/marketplace/marketplace.module.ts`
- [x] `src/modules/marketplace/marketplace.service.ts`
- [x] `src/modules/notices/notices.controller.ts`
- [x] `src/modules/notices/notices.module.ts`
- [x] `src/modules/payroll/payroll.controller.ts`
- [x] `src/modules/payroll/payroll.module.ts`
- [x] `src/modules/payroll/payroll.service.ts`
- [x] `src/modules/roles/dto/create-role.dto.ts`
- [x] `src/modules/roles/roles.controller.ts`
- [x] `src/modules/roles/roles.module.ts`
- [x] `src/modules/roles/roles.service.ts`
- [x] `src/modules/settings/settings.controller.ts`
- [x] `src/modules/settings/settings.module.ts`
- [x] `src/modules/settings/settings.service.ts`
- [x] `src/modules/sprint-payouts/sprint-payouts.controller.ts`
- [x] `src/modules/sprint-payouts/sprint-payouts.module.ts`
- [x] `src/modules/sprint-payouts/sprint-payouts.service.ts`
- [x] `src/modules/squads/squads.controller.ts`
- [x] `src/modules/squads/squads.module.ts`
- [x] `src/modules/squads/squads.service.ts`
- [x] `src/modules/tasks/tasks.controller.ts`
- [x] `src/modules/tasks/tasks.module.ts`
- [x] `src/modules/tasks/tasks.service.ts`
- [x] `src/modules/telemetry/telemetry.controller.ts`
- [x] `src/modules/telemetry/telemetry.module.ts`
- [x] `src/modules/telemetry/telemetry.service.ts`
- [x] `src/modules/users/users.controller.ts`
- [x] `src/modules/users/users.module.ts`
- [x] `src/modules/users/users.service.ts`
- [x] `src/prisma/prisma.module.ts`
- [x] `src/prisma/prisma.service.ts`

### Next.js frontend (59)

- [x] `frontend/.dockerignore`
- [x] `frontend/.env.example`
- [x] `frontend/.env.local`
- [x] `frontend/.gitignore`
- [x] `frontend/Dockerfile`
- [x] `frontend/README.md`
- [x] `frontend/app/(console)/accounting/page.tsx`
- [x] `frontend/app/(console)/audit-logs/page.tsx`
- [x] `frontend/app/(console)/bounty/page.tsx`
- [x] `frontend/app/(console)/chaos/page.tsx`
- [x] `frontend/app/(console)/clients/page.tsx`
- [x] `frontend/app/(console)/consultancy/page.tsx`
- [x] `frontend/app/(console)/finance/page.tsx`
- [x] `frontend/app/(console)/governance/page.tsx`
- [x] `frontend/app/(console)/layout.tsx`
- [x] `frontend/app/(console)/leaderboard/page.tsx`
- [x] `frontend/app/(console)/marketplace/page.tsx`
- [x] `frontend/app/(console)/notices/page.tsx`
- [x] `frontend/app/(console)/overview/page.tsx`
- [x] `frontend/app/(console)/payroll/page.tsx`
- [x] `frontend/app/(console)/people/page.tsx`
- [x] `frontend/app/(console)/people/user-profile-dialog.tsx`
- [x] `frontend/app/(console)/profile/page.tsx`
- [x] `frontend/app/(console)/quality/page.tsx`
- [x] `frontend/app/(console)/settings/page.tsx`
- [x] `frontend/app/(console)/squads/git-summary.tsx`
- [x] `frontend/app/(console)/squads/page.tsx`
- [x] `frontend/app/(console)/tasks/page.tsx`
- [x] `frontend/app/(console)/tasks/task-actions.tsx`
- [x] `frontend/app/globals.css`
- [x] `frontend/app/layout.tsx`
- [x] `frontend/app/page.tsx`
- [x] `frontend/app/providers.tsx`
- [x] `frontend/components/blocks.tsx`
- [x] `frontend/components/form-dialog.tsx`
- [x] `frontend/components/shell.tsx`
- [x] `frontend/components/ui/avatar.tsx`
- [x] `frontend/components/ui/badge.tsx`
- [x] `frontend/components/ui/button.tsx`
- [x] `frontend/components/ui/card.tsx`
- [x] `frontend/components/ui/checkbox.tsx`
- [x] `frontend/components/ui/dialog.tsx`
- [x] `frontend/components/ui/input.tsx`
- [x] `frontend/components/ui/label.tsx`
- [x] `frontend/components/ui/select.tsx`
- [x] `frontend/components/ui/separator.tsx`
- [x] `frontend/components/ui/skeleton.tsx`
- [x] `frontend/components/ui/table.tsx`
- [x] `frontend/components/ui/tabs.tsx`
- [x] `frontend/components/ui/textarea.tsx`
- [x] `frontend/components.json`
- [x] `frontend/lib/api.ts`
- [x] `frontend/lib/notice-crypto.ts`
- [x] `frontend/lib/utils.ts`
- [x] `frontend/next.config.mjs`
- [x] `frontend/package.json`
- [x] `frontend/postcss.config.js`
- [x] `frontend/tailwind.config.ts`
- [x] `frontend/tsconfig.json`

### Static browser client (3)

- [x] `public/app.js`
- [x] `public/index.html`
- [x] `public/style.css`

### Support and verification scripts (26)

- [x] `scripts/browser-e2e-testing.mjs`
- [x] `scripts/company-flow.mjs`
- [x] `scripts/comprehensive-security-audit.mjs`
- [x] `scripts/dbq.cjs`
- [x] `scripts/frontend-smoke.cjs`
- [x] `scripts/full-verify.mjs`
- [x] `scripts/independent-security-audit.mjs`
- [x] `scripts/loan-test.ps1`
- [x] `scripts/manual-qa-browser-test.mjs`
- [x] `scripts/notice-crypto.mjs`
- [x] `scripts/notice-smoke.mjs`
- [x] `scripts/playwright-full-suite.mjs`
- [x] `scripts/repro-pm-flow.mjs`
- [x] `scripts/security-audit-test.mjs`
- [x] `scripts/smoke-test.ps1`
- [x] `scripts/test-audit-fixes.mjs`
- [x] `scripts/test-executive-oversight.mjs`
- [x] `scripts/test-finance-scope.mjs`
- [x] `scripts/test-fine-approval.mjs`
- [x] `scripts/test-invitation-and-auth.mjs`
- [x] `scripts/test-ledger-posting.mjs`
- [x] `scripts/test-production-reset.mjs`
- [x] `scripts/test-rbac-hierarchy.mjs`
- [x] `scripts/test-squad-user-mgmt.mjs`
- [x] `scripts/test-task-flow.mjs`
- [x] `scripts/verify-fixes.mjs`

### Existing plans (9)

- [x] `plan/ceo.md`
- [x] `plan/cfo.md`
- [x] `plan/chro.md`
- [x] `plan/cto.md`
- [x] `plan/dev.md`
- [x] `plan/main.md`
- [x] `plan/other.md`
- [x] `plan/pm.md`
- [x] `plan/security.md`

### SRS setup (2)

- [x] `docs/srs/PHASE_STATUS.md`
- [x] `docs/srs/WORKING_RULES.md`

## Exclusions

- `node_modules/`, `frontend/node_modules/`: installed dependencies.
- `dist/`, `frontend/.next/`, `frontend/dist/`, `frontend/out/`: generated build output.
- `package-lock.json`, `frontend/package-lock.json`, `frontend/next-env.d.ts`, TypeScript build info, source maps: generated dependency/type/build artifacts; direct dependency declarations were inspected in both `package.json` files.
- `.git/`: repository metadata; `.hermes/` and `.agents/`: local agent state/skills, not application source. The applicable `documenting-legacy-codebases/SKILL.md` was read separately.
- `.env`, `frontend/.env.local`: local secrets/runtime state; example files and environment reads in source were inspected.
- Raster images, icons, font files, other binaries (`*.png`, `*.jpg`, `*.ico`, `*.svg`, `*.woff*`): no handwritten behavior.
- Newly generated audit documents: outputs, not inputs to this coverage denominator.

## Reproduction

Inventory method: recursively list regular files, exclude the paths and artifact types above, group by top-level source area, and compare each group with this list. The reviewed denominator is **208 files**. Source line references are from the working tree on 2026-11-07, including the untracked second migration.
