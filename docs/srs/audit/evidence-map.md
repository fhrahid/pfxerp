# Endpoint evidence map

Source-derived HTTP route inventory. The prefix is configured in `src/main.ts:15` and defaults to `/api/v1`; individual route paths come from controller decorators. “Authenticated” means the global JWT guard applies and no `@Roles` decorator appears on that handler. The CEO bypasses decorated role checks (`src/common/guards/roles.guard.ts:29`). Service-level checks may narrow access further. This is static evidence, not a runtime verification.

**143 decorated HTTP routes across 24 controller files.**

| Method | Default path | Decorator access | Handler evidence |
|---|---|---|---|
| POST | `/api/v1/cto/citations` | CTO | `src/modules/audit/audit.controller.ts:40` · `issue` |
| GET | `/api/v1/cto/citations` | authenticated | `src/modules/audit/audit.controller.ts:47` · `list` |
| GET | `/api/v1/cto/citations/:id` | authenticated | `src/modules/audit/audit.controller.ts:63` · `findOne` |
| POST | `/api/v1/cto/citations/:id/reverse-penalty` | CEO | `src/modules/audit/audit.controller.ts:69` · `reverse` |
| GET | `/api/v1/audit/logs` | CEO, CFO, CTO, CPO | `src/modules/audit/executive-audit.controller.ts:13` · `listLogs` |
| GET | `/api/v1/audit/executive-logs` | CEO, CFO, CTO, CPO | `src/modules/audit/executive-audit.controller.ts:13` · `listLogs` |
| POST | `/api/v1/auth/login` | public | `src/modules/auth/auth.controller.ts:64` · `login` |
| POST | `/api/v1/auth/refresh` | public | `src/modules/auth/auth.controller.ts:71` · `refresh` |
| POST | `/api/v1/auth/logout` | authenticated | `src/modules/auth/auth.controller.ts:77` · `logout` |
| POST | `/api/v1/auth/change-password` | authenticated | `src/modules/auth/auth.controller.ts:83` · `changePassword` |
| POST | `/api/v1/auth/forgot-password` | public | `src/modules/auth/auth.controller.ts:91` · `forgotPassword` |
| POST | `/api/v1/auth/reset-password` | public | `src/modules/auth/auth.controller.ts:98` · `resetPassword` |
| GET | `/api/v1/auth/me` | authenticated | `src/modules/auth/auth.controller.ts:103` · `me` |
| POST | `/api/v1/bounty/targets` | CTO, PM, CEO | `src/modules/bounty/bounty.controller.ts:78` · `createTarget` |
| GET | `/api/v1/bounty/targets` | authenticated | `src/modules/bounty/bounty.controller.ts:85` · `listTargets` |
| POST | `/api/v1/bounty/reports` | DEVELOPER, CTO | `src/modules/bounty/bounty.controller.ts:91` · `submitReport` |
| GET | `/api/v1/bounty/reports` | authenticated | `src/modules/bounty/bounty.controller.ts:98` · `listReports` |
| POST | `/api/v1/bounty/reports/:id/triage` | CTO | `src/modules/bounty/bounty.controller.ts:108` · `triage` |
| POST | `/api/v1/cto/certifications/apply` | authenticated | `src/modules/certifications/certifications.controller.ts:44` · `apply` |
| GET | `/api/v1/cto/certifications/queue` | CTO | `src/modules/certifications/certifications.controller.ts:50` · `queue` |
| GET | `/api/v1/cto/certifications/me` | authenticated | `src/modules/certifications/certifications.controller.ts:57` · `mine` |
| GET | `/api/v1/cto/certifications/consultants` | authenticated | `src/modules/certifications/certifications.controller.ts:63` · `consultants` |
| GET | `/api/v1/cto/certifications/user/:userId` | authenticated | `src/modules/certifications/certifications.controller.ts:68` · `byUser` |
| POST | `/api/v1/cto/certifications/:id/review` | CTO | `src/modules/certifications/certifications.controller.ts:74` · `review` |
| POST | `/api/v1/chaos/events` | CEO | `src/modules/chaos/chaos.controller.ts:53` · `trigger` |
| GET | `/api/v1/chaos/events` | authenticated | `src/modules/chaos/chaos.controller.ts:59` · `list` |
| POST | `/api/v1/chaos/events/:id/resolve` | CEO, PM | `src/modules/chaos/chaos.controller.ts:64` · `resolve` |
| POST | `/api/v1/clients` | CEO, CPO, CFO | `src/modules/clients/clients.controller.ts:70` · `createClient` |
| GET | `/api/v1/clients` | authenticated | `src/modules/clients/clients.controller.ts:76` · `listClients` |
| POST | `/api/v1/clients/contracts` | CEO, CPO, CFO | `src/modules/clients/clients.controller.ts:81` · `createContract` |
| GET | `/api/v1/clients/contracts` | authenticated | `src/modules/clients/clients.controller.ts:87` · `listContracts` |
| POST | `/api/v1/clients/milestones` | CEO, CPO, CFO, PM | `src/modules/clients/clients.controller.ts:92` · `addMilestone` |
| POST | `/api/v1/clients/milestones/:id/escrow` | CEO, CPO, CFO | `src/modules/clients/clients.controller.ts:98` · `fundEscrow` |
| POST | `/api/v1/clients/milestones/:id/assign` | CEO, CPO, CTO, PM | `src/modules/clients/clients.controller.ts:104` · `assign` |
| POST | `/api/v1/clients/milestones/:id/cto-audit` | CTO | `src/modules/clients/clients.controller.ts:110` · `ctoAudit` |
| POST | `/api/v1/clients/milestones/:id/client-accept` | PM, CEO, CPO | `src/modules/clients/clients.controller.ts:116` · `clientAccept` |
| POST | `/api/v1/cto/consultancy/bookings` | PM, CTO | `src/modules/consultancy/consultancy.controller.ts:37` · `book` |
| GET | `/api/v1/cto/consultancy/bookings` | authenticated | `src/modules/consultancy/consultancy.controller.ts:43` · `list` |
| POST | `/api/v1/cto/consultancy/bookings/:id/complete` | CTO, DEVELOPER, PM, CPO | `src/modules/consultancy/consultancy.controller.ts:53` · `complete` |
| POST | `/api/v1/cto/consultancy/bookings/:id/cancel` | PM, CTO | `src/modules/consultancy/consultancy.controller.ts:59` · `cancel` |
| GET | `/api/v1/dashboard/ceo` | CEO | `src/modules/dashboard/dashboard.controller.ts:15` · `ceo` |
| GET | `/api/v1/dashboard/cto` | CTO, CEO | `src/modules/dashboard/dashboard.controller.ts:21` · `cto` |
| GET | `/api/v1/cto/squad-tech-scores` | authenticated | `src/modules/dashboard/dashboard.controller.ts:28` · `squadTechScores` |
| GET | `/api/v1/dashboard/cfo` | CFO, CEO | `src/modules/dashboard/dashboard.controller.ts:33` · `cfo` |
| POST | `/api/v1/dashboard/cfo/recalculate-valuations` | CFO, CEO | `src/modules/dashboard/dashboard.controller.ts:39` · `recalculateValuations` |
| GET | `/api/v1/dashboard/me` | authenticated | `src/modules/dashboard/dashboard.controller.ts:45` · `me` |
| GET | `/api/v1/simulation-scores` | authenticated | `src/modules/dashboard/dashboard.controller.ts:51` · `leaderboard` |
| POST | `/api/v1/equity` | CFO | `src/modules/equity/equity.controller.ts:28` · `invest` |
| GET | `/api/v1/equity` | CFO, CEO | `src/modules/equity/equity.controller.ts:34` · `portfolio` |
| POST | `/api/v1/governance/decisions` | CFO, CTO, CPO | `src/modules/governance/governance.controller.ts:50` · `propose` |
| GET | `/api/v1/governance/decisions` | CEO, CFO, CTO, CPO | `src/modules/governance/governance.controller.ts:56` · `list` |
| POST | `/api/v1/governance/decisions/:id/vote` | CFO, CTO, CPO | `src/modules/governance/governance.controller.ts:62` · `vote` |
| POST | `/api/v1/governance/decisions/:id/ceo-decide` | CEO | `src/modules/governance/governance.controller.ts:68` · `ceoDecide` |
| POST | `/api/v1/invitations` | CEO, CFO, CTO, CPO | `src/modules/invitations/invitations.controller.ts:15` · `create` |
| GET | `/api/v1/invitations` | CEO, CFO, CTO, CPO | `src/modules/invitations/invitations.controller.ts:23` · `list` |
| POST | `/api/v1/invitations/:id/resend` | CEO, CFO, CTO, CPO | `src/modules/invitations/invitations.controller.ts:31` · `resend` |
| DELETE | `/api/v1/invitations/:id` | CEO, CFO, CTO, CPO | `src/modules/invitations/invitations.controller.ts:40` · `revoke` |
| GET | `/api/v1/invitations/verify/:token` | public | `src/modules/invitations/invitations.controller.ts:49` · `verify` |
| POST | `/api/v1/invitations/accept` | public | `src/modules/invitations/invitations.controller.ts:56` · `accept` |
| POST | `/api/v1/ledger/verify-chain` | CEO | `src/modules/ledger/ledger.controller.ts:73` · `verifyChain` |
| GET | `/api/v1/ledger/transactions` | CEO, CFO | `src/modules/ledger/ledger.controller.ts:79` · `recent` |
| POST | `/api/v1/ledger/allocate` | CFO | `src/modules/ledger/ledger.controller.ts:92` · `allocate` |
| POST | `/api/v1/ledger/allocate-personal` | CFO | `src/modules/ledger/ledger.controller.ts:114` · `allocatePersonal` |
| POST | `/api/v1/ledger/squads/:id/return-funds` | CFO | `src/modules/ledger/ledger.controller.ts:138` · `returnSquadFunds` |
| POST | `/api/v1/ledger/reserve/sweep` | CEO | `src/modules/ledger/ledger.controller.ts:156` · `sweepAllFunds` |
| GET | `/api/v1/ledger/accounts` | authenticated | `src/modules/ledger/ledger.controller.ts:165` · `accounts` |
| GET | `/api/v1/ledger/accounts/:id/entries` | authenticated | `src/modules/ledger/ledger.controller.ts:178` · `accountEntries` |
| GET | `/api/v1/ledger/pool-funding/requests` | CEO, CFO | `src/modules/ledger/ledger.controller.ts:189` · `listPoolFundingRequests` |
| POST | `/api/v1/ledger/pool-funding/requests` | CFO | `src/modules/ledger/ledger.controller.ts:198` · `requestPoolFunding` |
| POST | `/api/v1/ledger/pool-funding/requests/:id/approve` | CEO | `src/modules/ledger/ledger.controller.ts:210` · `approvePoolFunding` |
| POST | `/api/v1/ledger/pool-funding/direct` | CEO | `src/modules/ledger/ledger.controller.ts:219` · `directPoolFunding` |
| POST | `/api/v1/accounts/:id/freeze` | CEO | `src/modules/ledger/ledger.controller.ts:259` · `freeze` |
| POST | `/api/v1/accounts/:id/bonus` | CEO | `src/modules/ledger/ledger.controller.ts:284` · `bonus` |
| POST | `/api/v1/loans` | PM | `src/modules/loans/loans.controller.ts:23` · `apply` |
| GET | `/api/v1/loans` | authenticated | `src/modules/loans/loans.controller.ts:29` · `list` |
| POST | `/api/v1/loans/:id/approve` | CFO | `src/modules/loans/loans.controller.ts:35` · `disburse` |
| POST | `/api/v1/loans/:id/repay` | PM | `src/modules/loans/loans.controller.ts:41` · `repay` |
| POST | `/api/v1/cto/marketplace/listings` | authenticated | `src/modules/marketplace/marketplace.controller.ts:39` · `create` |
| GET | `/api/v1/cto/marketplace/listings` | authenticated | `src/modules/marketplace/marketplace.controller.ts:45` · `list` |
| POST | `/api/v1/cto/marketplace/listings/:id/purchase` | PM, CTO | `src/modules/marketplace/marketplace.controller.ts:54` · `purchase` |
| POST | `/api/v1/cto/marketplace/listings/:id/verify` | CTO | `src/modules/marketplace/marketplace.controller.ts:65` · `verify` |
| POST | `/api/v1/cto/marketplace/listings/:id/delist` | CTO | `src/modules/marketplace/marketplace.controller.ts:72` · `delist` |
| POST | `/api/v1/notices/keys/register` | authenticated | `src/modules/notices/notices.controller.ts:75` · `registerKeys` |
| GET | `/api/v1/notices/keys/:userId` | authenticated | `src/modules/notices/notices.controller.ts:105` · `getUserPublicKey` |
| POST | `/api/v1/notices` | CPO, CEO | `src/modules/notices/notices.controller.ts:116` · `dispatch` |
| GET | `/api/v1/notices` | authenticated | `src/modules/notices/notices.controller.ts:161` · `inbox` |
| POST | `/api/v1/notices/:id/acknowledge` | authenticated | `src/modules/notices/notices.controller.ts:172` · `acknowledge` |
| POST | `/api/v1/payroll` | PM | `src/modules/payroll/payroll.controller.ts:89` · `submit` |
| GET | `/api/v1/payroll` | authenticated | `src/modules/payroll/payroll.controller.ts:95` · `list` |
| POST | `/api/v1/payroll/:id/approve` | CPO, CEO | `src/modules/payroll/payroll.controller.ts:101` · `approve` |
| POST | `/api/v1/payroll/:id/reject` | CPO | `src/modules/payroll/payroll.controller.ts:107` · `reject` |
| POST | `/api/v1/fines/slacker` | CPO | `src/modules/payroll/payroll.controller.ts:114` · `slacker` |
| POST | `/api/v1/fines/proposals` | CPO, CTO, CEO | `src/modules/payroll/payroll.controller.ts:120` · `proposeFine` |
| GET | `/api/v1/fines/proposals` | CFO, CPO, CTO, CEO | `src/modules/payroll/payroll.controller.ts:126` · `listFineProposals` |
| POST | `/api/v1/fines/proposals/:id/approve` | CFO | `src/modules/payroll/payroll.controller.ts:132` · `approveFine` |
| GET | `/api/v1/roles` | authenticated | `src/modules/roles/roles.controller.ts:15` · `listRoles` |
| POST | `/api/v1/roles` | CEO | `src/modules/roles/roles.controller.ts:22` · `createRole` |
| GET | `/api/v1/settings` | CEO, CFO, CTO, CPO | `src/modules/settings/settings.controller.ts:44` · `list` |
| PUT | `/api/v1/settings` | CEO | `src/modules/settings/settings.controller.ts:50` · `update` |
| GET | `/api/v1/settings/current-sprint` | authenticated | `src/modules/settings/settings.controller.ts:60` · `currentSprint` |
| POST | `/api/v1/settings/current-sprint` | CEO, CFO, CTO, CPO | `src/modules/settings/settings.controller.ts:66` · `setCurrentSprint` |
| GET | `/api/v1/settings/production-reset/status` | CEO | `src/modules/settings/settings.controller.ts:73` · `productionResetStatus` |
| POST | `/api/v1/settings/production-reset` | CEO | `src/modules/settings/settings.controller.ts:79` · `resetProductionData` |
| POST | `/api/v1/sprint-payouts` | CFO | `src/modules/sprint-payouts/sprint-payouts.controller.ts:37` · `submit` |
| GET | `/api/v1/sprint-payouts` | CEO, CFO, CTO, CPO, PM | `src/modules/sprint-payouts/sprint-payouts.controller.ts:43` · `list` |
| POST | `/api/v1/sprint-payouts/:id/ceo-approve` | CEO | `src/modules/sprint-payouts/sprint-payouts.controller.ts:49` · `ceoApprove` |
| POST | `/api/v1/sprint-payouts/:id/execute` | CFO | `src/modules/sprint-payouts/sprint-payouts.controller.ts:55` · `execute` |
| GET | `/api/v1/squads` | authenticated | `src/modules/squads/squads.controller.ts:87` · `list` |
| GET | `/api/v1/squads/:id` | authenticated | `src/modules/squads/squads.controller.ts:92` · `findOne` |
| POST | `/api/v1/squads` | CPO, CEO | `src/modules/squads/squads.controller.ts:98` · `create` |
| PATCH | `/api/v1/squads/:id` | CPO, CEO | `src/modules/squads/squads.controller.ts:105` · `update` |
| DELETE | `/api/v1/squads/:id` | CEO | `src/modules/squads/squads.controller.ts:112` · `remove` |
| GET | `/api/v1/squads/:id/github/repos` | authenticated | `src/modules/squads/squads.controller.ts:119` · `listRepos` |
| POST | `/api/v1/squads/:id/github/repos` | PM, CEO, CFO, CTO, CPO | `src/modules/squads/squads.controller.ts:125` · `addRepo` |
| DELETE | `/api/v1/squads/:id/github/repos/:repoId` | PM, CEO, CFO, CTO, CPO | `src/modules/squads/squads.controller.ts:132` · `removeRepo` |
| GET | `/api/v1/squads/:id/github/repos/:repoId/activity` | authenticated | `src/modules/squads/squads.controller.ts:139` · `repoActivity` |
| GET | `/api/v1/squads/:id/github/repos/:repoId/summary` | authenticated | `src/modules/squads/squads.controller.ts:145` · `repoSummary` |
| POST | `/api/v1/squads/:id/members` | CPO, CEO | `src/modules/squads/squads.controller.ts:151` · `addMember` |
| POST | `/api/v1/squads/members/transfer` | CPO, CEO | `src/modules/squads/squads.controller.ts:157` · `transferMember` |
| DELETE | `/api/v1/squads/:id/members/:userId` | CPO, CEO | `src/modules/squads/squads.controller.ts:167` · `removeMember` |
| POST | `/api/v1/tasks` | PM, CTO, CPO, CEO | `src/modules/tasks/tasks.controller.ts:129` · `create` |
| GET | `/api/v1/tasks` | authenticated | `src/modules/tasks/tasks.controller.ts:135` · `list` |
| GET | `/api/v1/tasks/pending-verification` | CTO, CEO | `src/modules/tasks/tasks.controller.ts:151` · `pending` |
| GET | `/api/v1/tasks/:id` | authenticated | `src/modules/tasks/tasks.controller.ts:157` · `findOne` |
| PATCH | `/api/v1/tasks/:id` | PM, CTO, CPO, CEO | `src/modules/tasks/tasks.controller.ts:162` · `update` |
| POST | `/api/v1/tasks/:id/start` | DEVELOPER, PM | `src/modules/tasks/tasks.controller.ts:168` · `start` |
| POST | `/api/v1/tasks/:id/flag-complete` | authenticated | `src/modules/tasks/tasks.controller.ts:174` · `flagComplete` |
| POST | `/api/v1/tasks/:id/pm-verify` | PM | `src/modules/tasks/tasks.controller.ts:183` · `pmVerify` |
| POST | `/api/v1/tasks/:id/pm-reject` | PM | `src/modules/tasks/tasks.controller.ts:189` · `pmReject` |
| POST | `/api/v1/tasks/:id/cto-verify` | CTO | `src/modules/tasks/tasks.controller.ts:195` · `ctoVerify` |
| POST | `/api/v1/tasks/:id/cto-reject` | CTO | `src/modules/tasks/tasks.controller.ts:201` · `ctoReject` |
| POST | `/api/v1/tasks/:id/close` | PM, CTO | `src/modules/tasks/tasks.controller.ts:207` · `close` |
| POST | `/api/v1/telemetry/ingest` | public | `src/modules/telemetry/telemetry.controller.ts:42` · `ingest` |
| POST | `/api/v1/products` | PM, CEO, CTO, CPO | `src/modules/telemetry/telemetry.controller.ts:51` · `createProduct` |
| GET | `/api/v1/products` | authenticated | `src/modules/telemetry/telemetry.controller.ts:58` · `listProducts` |
| GET | `/api/v1/products/:id` | authenticated | `src/modules/telemetry/telemetry.controller.ts:64` · `getProduct` |
| GET | `/api/v1/products/:id/telemetry` | authenticated | `src/modules/telemetry/telemetry.controller.ts:70` · `getTelemetry` |
| GET | `/api/v1/users` | CEO, CFO, CTO, CPO | `src/modules/users/users.controller.ts:71` · `list` |
| POST | `/api/v1/users` | CPO, CEO | `src/modules/users/users.controller.ts:93` · `create` |
| GET | `/api/v1/users/:id/profile` | authenticated | `src/modules/users/users.controller.ts:100` · `findOne` |
| GET | `/api/v1/users/:id` | authenticated | `src/modules/users/users.controller.ts:101` · `findOne` |
| PATCH | `/api/v1/users/:id` | CPO, CEO | `src/modules/users/users.controller.ts:127` · `update` |
| DELETE | `/api/v1/users/:id` | CEO | `src/modules/users/users.controller.ts:134` · `remove` |

## Non-HTTP surfaces

- Socket.IO `/events`, `subscribe`, unrestricted room joins: `src/events/events.gateway.ts:18`, `:34–39`. Outgoing events are published by business services through the gateway.
- Static browser client at `/`: `src/main.ts:25–26`, `public/index.html:13`, `public/app.js:4`.
- Swagger UI at `/api/docs`: `src/main.ts:28–35`.
- Scheduled and interval work: `src/modules/tasks/tasks.service.ts:209–210`, `src/modules/dashboard/dashboard.service.ts:75–76`, `src/modules/chaos/chaos.service.ts:25–30`.

## Evidence conventions

- For each implemented feature claim, use the owning controller and service, and cite the schema model when data persistence matters.
- The route table records declarations only. Confirm service behavior and ownership checks before writing precise SRS requirements.
