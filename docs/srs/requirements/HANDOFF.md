# Common SRS handoff

**Phase:** shared requirements draft complete on 2026-11-07. Output: [common-srs.md](common-srs.md). This was documentation only; no application tests, deployment checks or UML diagrams were run or created.

The document contains introduction/scope, system context, user classes, architecture, external interfaces, shared functional requirements, non-functional requirements, constraints, integrations, glossary and references. IDs `FR-SYS-001`–`FR-SYS-038`, `NFR-001`–`NFR-018` and `BR-001`–`BR-022` are allocated here. `FR-SYS-036`–`038` were added in the 2026-11-07 ABAC consistency pass to cover CEO-managed grant assignment, revocation and audit; `NFR-017`/`018` separate audit retention from retrieval scope. Every row carries priority, evidence status and traceability. Priority is TBD because no approved requirement-level ranking was evidenced. Numeric service targets without evidence remain TBD.

The common SRS separates current source behavior from owner decisions. It treats CHRO/CPO separation, multiple job-role labels, ABAC and deliverable-specific task evidence as **PLANNED**; a versioned notice envelope as **PLANNED**; whole-batch sprint payout atomicity as **PROPOSED**. Source-level `IMPLEMENTED` does not mean current deployment acceptance. Key implementation gaps are linked to `docs/srs/access/authorization-gaps.md` and `docs/srs/workflows/HANDOFF.md`.

Before role-specific requirements are finalized, the owner must decide CHRO/CPO duties beyond payroll approval, payroll payment/rejection authority, CEO financial override and maker/checker policy, external client acceptance proof, read/export scopes, and numeric performance/availability/recovery/accessibility targets. Later perspective documents should reference common IDs rather than duplicate their obligations. The common draft still needs a consistency/acceptance review in the final SRS review phase.

**Later consistency update (2026-11-07):** The target is ABAC with an active direct service/action grant as a required subject entitlement in DEC-03. The five original perspective drafts and handoffs are in `PERSPECTIVES_HANDOFF.md`; this handoff retains the drafting history.
