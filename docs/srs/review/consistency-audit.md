# Independent SRS consistency audit

**Review date:** 2026-11-07. **Scope:** `WORKING_RULES.md`; six requirements files (common, CHRO, CTO, CFO, PM, Developer); current RBAC matrix and target service-access policy; `DECISIONS.md`; workflow catalog/business rules; use-case index, seven description files and six PlantUML sources; audit evidence map; targeted controller/service/schema reads. This is a documentation and source audit, not deployed-system acceptance. No application code or configuration was changed. The companion [Requirements Traceability Matrix](requirements-traceability-matrix.md) is the row-level evidence ledger.

**Amendment, 2026-11-07:** The findings below record the original review baseline. A later documentation pass changed the target to ABAC with mandatory direct grants and corrected several findings. See the reconciliation at the end; the original findings are retained as audit history.

## Review outcome by requested check

| Check | Result | Basis |
|---|---|---|
| Requirement completeness and IDs | **PARTIAL.** 111 allocated IDs (72 FR, 17 NFR, 22 BR) are unique and syntactically consistent. CPO perspective is absent; 17 source-observed use cases have no allocated FR; several security and approval policies remain open. | `requirements/common-srs.md`; five perspective files; `use-cases/*.md`; RTM. |
| Evidence for implemented claims | **PARTIAL.** All 88 `IMPLEMENTED`/`PARTIAL` RTM rows cite an existing source path, and sampled line references are in bounds. Citation existence alone does not establish the full claim; the notice-envelope rationale is materially wrong (RA-03). Separate deployment behavior is UNVERIFIED. | RTM; `src/modules/notices/notices.controller.ts:55–70`; `frontend/lib/notice-crypto.ts:74–89`. |
| Role responsibility consistency | **PARTIAL.** Current CPO/CEO versus target CHRO separation is mostly marked. The target CPO document is missing, and composite use cases imply broader actor authority than current routes (RA-05). | `access/rbac-matrix.md`; `requirements/chro-requirements.md`; `diagrams/use-cases/overall-erp.puml`. |
| ABAC correctness and least privilege | **UNVERIFIED target; PARTIAL current controls.** The latest owner direction is SBAC with resource/state attributes, a grant-plus-attribute model. It is neither implemented nor fully specified; older documents still say ABAC. Current broad reads and CEO bypass remain. | `DECISIONS.md` DEC-03; `access/service-access-policy.md`; `src/common/guards/roles.guard.ts:15–33`; RA-01/RA-06. |
| Use-case coverage | **PARTIAL.** All 72 FR IDs appear in the use-case index or are labeled non-interactive, but 17 user-facing cases have no FR. CEO pool-funding approval and squad creation lack dedicated cases. | `use-cases/use-case-index.md`; `use-cases/*.md`; RA-04. |
| DFD balancing | **NOT ASSESSABLE.** No context, level-0 or decomposed DFD source/index exists. No balancing claim is possible. | `diagrams/` contains only `use-cases/*.puml`. |
| Activity/sequence workflow consistency | **NOT ASSESSABLE diagram-to-workflow.** Ten prose workflows exist; no activity or sequence diagram source exists. The existing use-case diagrams show goals, not order or messages. | `workflows/workflow-catalog.md` WF-01–WF-10; `diagrams/use-cases/*.puml`. |
| Class versus ERD consistency | **NOT ASSESSABLE diagram-to-diagram.** The Prisma schema and local database baseline are documented, but no class diagram or ERD exists. | `prisma/schema.prisma:1–1083`; `audit/database-baseline.md`; diagram inventory. |
| Business-rule contradictions | **PARTIAL.** Current CEO early board decision, combined payroll approval/payment and partial payout execution are described, but target approval rules remain open. Old TAR-01 ABAC wording contradicts DEC-03; notice rationale contradicts current validation. | RA-01/RA-03/RA-07; `workflows/business-rules.md:49`; `src/modules/governance/governance.service.ts:96–120`. |
| Incorrect/unverified/missing requirements | **PARTIAL.** Numeric NFR targets and several scopes are TBD; notice rationale is wrong; CPO and some current user goals lack requirements. | RA-02/RA-03/RA-04/RA-09. |
| Security and approval flow | **HIGH risk in source and incomplete target policy.** Event-room joins, broad reads, privilege concentration, CEO override, payment/approval coupling and partial financial writes are evidenced. | RA-06–RA-08; `access/authorization-gaps.md`. |
| Academic document quality | **DRAFT.** Status and source conventions are useful, but requirement atomicity, testability, use-case actor precision and missing diagram families prevent final SRS sign-off. | RA-05/RA-09/RA-10; `WORKING_RULES.md:20–31`. |

## Findings, ordered by impact

### RA-01 — Target access vocabulary conflicts across documents (High)

`DECISIONS.md:9` specifies service/action grants checked with resource and state attributes. This is a grant-plus-attribute policy, often described as ABAC-like, but **the owner explicitly replaced role-derived access with service-based access**. `workflows/business-rules.md:49`, `workflows/cross-role-dependencies.md:22` and `audit/open-questions.md:11,15` still call the target ABAC. This can lead implementers to derive permissions from job labels, contrary to DEC-03 and `access/service-access-policy.md`. The owner has now selected CEO-managed direct per-person grants. Grant scope limits, grant lifecycle, deny precedence, revocation propagation, policy evaluation points and exact read scopes are still not specified. **Action:** mark older text as historical or align terminology to DEC-03; define the remaining policy decisions only after owner approval. Do not treat the current RBAC matrix as a target grant list.

### RA-02 — Required CPO perspective is absent (High)

`WORKING_RULES.md:15` and `DECISIONS.md:8` require distinct CHRO and CPO target perspectives. The six current requirement files contain common plus CHRO, CTO, CFO, PM and Developer; there is no CPO requirements file or CPO use-case diagram. Current CPO controls users, squads, payroll, notices, products and client actions (`src/modules/users/users.controller.ts:91–137`; `src/modules/squads/squads.controller.ts:87–175`; `src/modules/payroll/payroll.controller.ts:98–128`; `src/modules/clients/clients.controller.ts:70–119`). Only CHRO payroll approval is owner-settled. **Action:** add a CPO target perspective after the owner decides which current people actions transfer; leave each unresolved action UNVERIFIED meanwhile.

### RA-03 — Notice-envelope implementation rationale is incorrect (High)

The current-state rationale in `DECISIONS.md:10`, the notice interface row in `requirements/common-srs.md`, `audit/architecture-inventory.md` and prior handoffs says the server *requires* a separate `tag` and will reject current browser envelopes. FR-SYS-034/NFR-016 specify the owner-selected future envelope, which is a separate question. In the current dispatch path, `assertEncryptedEnvelope` parses `ephemPk`, `alg`, `iv` and `data`, but does **not** inspect `tag` (`src/modules/notices/notices.controller.ts:55–70`, `:116–134`). The browser envelope stores Web Crypto AES-GCM ciphertext plus tag in `data` and omits a separate field (`frontend/lib/notice-crypto.ts:74–89`; `public/app.js:2547–2562`). The owner-selected versioned, separate-tag target remains PLANNED; the claim about current server rejection is unsupported. **Action:** correct the current-state explanation and verify end-to-end behavior before claiming a dispatch failure. Keep target cryptographic design distinct from current validation.

### RA-04 — Functional coverage is one-way only (High)

The index maps all 72 FR IDs, but 17 source-observed cases say “None allocated”: `UC-SYS-017`–`021`, `022`–`029` (where present) and `030`–`033`; the exact list is in the use-case descriptions. These include account administration, marketplace purchase/delist, bounty target funding, sprint setting, fine/payroll rejection and valuation recalculation. `BR-019`/WF-09 and `src/modules/ledger/ledger.controller.ts:210–215` show CEO pool-funding approval, yet there is no dedicated approving-actor case. `BR-004` cites squad creation, while the existing `UC-SYS-006` is membership maintenance. **Action:** decide which source-observed goals belong in target scope, allocate FR/UC IDs for retained goals, and identify explicit exclusions. A FR-to-UC count alone is not complete bidirectional traceability.

### RA-05 — Composite use cases blur least-privilege boundaries (High)

`UC-SYS-016` combines client/contract creation, milestone creation, funding and assignment, then associates PM with the whole use case (`diagrams/use-cases/overall-erp.puml:91,169`; `use-cases/clients.md:37–52`). Current PM may add a milestone and assign a milestone, but cannot create a client/contract or fund escrow (`src/modules/clients/clients.controller.ts:70–107`). `UC-SYS-009` combines board proposal/vote with CEO final decision, although board members cannot take the CEO route (`src/modules/governance/governance.controller.ts:50–71`; `src/modules/governance/governance.service.ts:20–120`). **Action:** split these into actor-goal cases or label each association with its exact step and current/target status. Do not infer an approval grant from a supporting actor association.

### RA-06 — Current data exposure exceeds least-privilege intent (High)

The current fixed-role guard permits CEO through decorated route checks (`src/common/guards/roles.guard.ts:15–33`); the event gateway joins `studio` on connection and accepts `squad:*`/`user:*` room subscriptions without identity/ownership checks (`src/events/events.gateway.ts:25–39`). Authenticated client, bounty, consultancy and citation list queries are broad (`access/authorization-gaps.md` GAP-01/02). `FR-SYS-033`, NFR-015 and FR-SYS-035 are PROPOSED with target scopes TBD, so the least-privilege claim is not an implemented property. **Action:** establish approved per-resource/event visibility and enforced decision points; retain these exposures as source risks, not approved permissions.

### RA-07 — Approval and execution separation is unresolved (High)

Current CPO/CEO payroll approval also disburses (`src/modules/payroll/payroll.controller.ts:98–109`; `src/modules/payroll/payroll.service.ts:200–317`), while target CHRO approval is PLANNED and the payment executor/rejector is UNVERIFIED (`requirements/chro-requirements.md` FR-CHRO-002/003). CEO can reach CFO payout execution through the role override, and payout tax credits the executing caller’s wallet (`src/common/guards/roles.guard.ts:27–33`; `src/modules/sprint-payouts/sprint-payouts.service.ts:108–132`). CEO may finalize a board decision before two votes (`src/modules/governance/governance.service.ts:96–120`). Internal PM/CPO/CEO records “client acceptance”; no authenticated client actor supplies proof (`src/modules/clients/clients.controller.ts:116–119`). **Action:** obtain explicit maker/checker, CEO exception, payroll executor/rejector and client-attestation decisions; do not upgrade any of them to IMPLEMENTED target authority.

### RA-08 — Financial completion and audit guarantees are overstated or missing (High)

`BR-022`/FR-SYS-021 correctly mark whole-batch payout atomicity PROPOSED; source posts each squad separately before final status (`src/modules/sprint-payouts/sprint-payouts.service.ts:108–190`). Marketplace, consultancy, loan and milestone flows can post money before later record changes (`src/modules/marketplace/marketplace.service.ts:100–126`; `src/modules/consultancy/consultancy.service.ts:69–94`, `:111–166`; `src/modules/loans/loans.service.ts:109–145`; `src/modules/clients/clients.service.ts:199–231`). User account update and payout approval/execute audit writes can fail without failing the business operation (`src/modules/users/users.service.ts:168–199`; `src/modules/sprint-payouts/sprint-payouts.service.ts:95–105`, `:172–190`). **Action:** specify failure reconciliation and mandatory audit outcomes as proposed requirements, with owner-approved scope and retention. Do not describe these cross-service workflows as atomic today.

### RA-09 — Acceptance criteria remain incomplete (Medium)

`NFR-011`–`014` and `NFR-017` use TBD workload, latency, availability, recovery, accessibility, browser or retention values (`requirements/common-srs.md:168–174`). This is honest but not test-ready. The shared `FR-SYS-035` has no approved per-resource visibility scope, and direct per-person grant administration is owner-approved but lacks an allocated grant/revoke functional requirement (`requirements/common-srs.md:117`; `access/service-access-policy.md`). **Action:** retain TBD until approved, then add measurable acceptance conditions and test environment. Do not invent thresholds.

### RA-10 — Several requirements and cases combine obligations or generic flows (Medium)

`FR-SYS-006` combines multi-label storage and the rule that labels grant no service access; `NFR-017` combines retention and scoped retrieval; `BR-011` uses “may,” which leaves the acceptance condition less precise (`requirements/common-srs.md:88,137,174`). Most generated use-case main flows repeat “check stated preconditions” rather than state the specific validation step (for example `use-cases/people.md:9–16`; `use-cases/work.md:9–16`). **Action:** split independently testable obligations and replace generic flow text with case-specific inputs, checks and outcomes during editorial review. Preserve existing IDs through a traceable supersession plan.

### RA-11 — Diagram family and data-model review cannot be completed (Medium)

Only `diagrams/use-cases/*.puml` exists. DFD balancing, activity/sequence consistency and class-versus-ERD consistency need the missing diagrams and indexes. The Prisma model and local database baseline support later ERD review, but do not substitute for an ERD/class comparison (`prisma/schema.prisma:1–1083`; `audit/database-baseline.md`). **Action:** create those editable sources in later authorized phases, then review external entities/flows, state transitions/messages and relationship/cardinality correspondence. No passing result is recorded for absent artifacts.

### RA-12 — Status and proof dimensions need explicit separation (Medium)

The perspective documents label most operations PARTIAL because source business logic exists but target service grants do not (`requirements/cto-requirements.md:3`, `requirements/cfo-requirements.md:3`). The common SRS labels the same business logic IMPLEMENTED, which is coherent only if readers distinguish *operation in source* from *target entitlement*. `UC-SYS-007` describes a target payment executor that is TBD while FR-SYS-018 is IMPLEMENTED for current combined payment. **Action:** add separate columns for current business operation, current enforcement, target grant and deployed verification in a final trace view. Do not collapse them into one status.

## Evidence and validation limits

The RTM was generated from allocated requirement rows and cross-checked against the use-case index and PlantUML aliases. Source citations in the 88 IMPLEMENTED/PARTIAL rows resolve to repository files; no runtime execution, security penetration test, database mutation or separate-deployment inspection was performed. The PlantUML files were statically checked for unique aliases and resolved actor links in the preceding phase; no renderer is installed, so visual layout and renderer syntax are still UNVERIFIED. The local PostgreSQL baseline is documented in `audit/database-baseline.md`; a separate deployed schema is UNVERIFIED.

## Reconciliation after the ABAC consistency pass

| Finding | Current disposition |
|---|---|
| RA-01 | **Corrected in target documents.** DEC-03 and the access policy now define ABAC with a mandatory active direct grant; the role matrix remains current source evidence. Grant scopes, bootstrap and override policy remain open (GAP-12). |
| RA-02 | **Partially addressed.** A CPO perspective document and current-source diagram now exist. The CHRO/CPO target action split remains UNVERIFIED, so no CPO-specific target FR was invented. |
| RA-03 | **Corrected in source descriptions.** Dispatch does not require a separate `tag`; browser clients combine tag with ciphertext in `data`. The versioned separate-tag target remains PLANNED; end-to-end behavior remains UNVERIFIED. |
| RA-04 | **Open.** The 17 previously identified source-observed cases still lack allocated target FR IDs; CEO pool approval and squad creation still need dedicated cases if retained in target scope. |
| RA-05 | **Mitigated.** UC-SYS-009 and UC-SYS-016 now identify each actor's current step in text and diagram associations. They remain composite cases and could be split during final use-case modeling. |
| RA-06–RA-08 | **Open.** Event/list visibility, approval separation, CEO exception and financial recovery need policy and implementation decisions. |
| RA-09 | **Partially addressed.** FR-SYS-036–038 and UC-SYS-034 now cover CEO direct grant assignment, revocation and audit. Numeric NFR targets, grant scopes and grant-administrator bootstrap remain unresolved. |
| RA-10 | **Partially addressed.** FR-SYS-006 is singular, BR-011 uses a verifiable obligation, and NFR-017/018 separate retention from retrieval. Generic use-case flow wording remains for editorial review. |
| RA-11–RA-12 | **Open.** Missing diagram families and separate current/target/deployed verification dimensions remain for the next review. |

The amended [RTM](requirements-traceability-matrix.md) has 115 IDs (75 FR, 18 NFR, 22 BR), and the [use-case index](../use-cases/use-case-index.md) has 70 cases. This reconciliation is not SRS approval.

**Later diagram check:** all seven use-case PlantUML files rendered successfully to SVG and PNG with PlantUML 1.2026.9/Smetana on 2026-11-07, and each image was visually inspected. This resolves the use-case rendering uncertainty recorded above; RA-11 remains open for the absent DFD, activity, sequence, class and ERD sources.
