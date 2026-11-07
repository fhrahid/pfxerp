# SRS Working Rules

These rules govern preparation of the Pointfex ERP Software Requirements Specification (SRS). They apply to every SRS phase and deliverable.

## Scope and evidence

1. **Documentation only.** Never modify application code, configuration, database schema, migrations, tests, or build/deployment files as part of SRS work. Write or update documentation files only.
2. **Label evidence status.** Mark each feature or requirement as exactly one of `IMPLEMENTED`, `PARTIAL`, `PLANNED`, `PROPOSED`, or `UNVERIFIED`:
   - `IMPLEMENTED`: evidence confirms the complete stated behavior exists.
   - `PARTIAL`: evidence confirms only part of the stated behavior exists; identify the implemented and missing parts.
   - `PLANNED`: an existing, authoritative project plan or specification explicitly commits to the behavior, but implementation has not been confirmed.
   - `PROPOSED`: a new candidate requirement or behavior that is not an established commitment.
   - `UNVERIFIED`: available evidence is insufficient or conflicting; state what remains unresolved.
3. **Trace implemented claims.** Every `IMPLEMENTED` claim must cite one or more precise source-file paths. Include line or symbol references where practical. Do not use plans or comments as sole proof of implementation.
4. **Do not invent.** Never invent features, permissions, database fields, constraints, calculations, workflows, or business rules. Preserve uncertainty and conflicts as `UNVERIFIED` and record the evidence gap.
5. **Separate perspectives.** Organize requirements for the CHRO, CPO, CTO, CFO, PM, and Developer perspectives. CHRO and CPO are distinct target roles (see `docs/srs/DECISIONS.md`); current code uses `CPO` for the combined role. Document shared capabilities once in a shared section and reference them from relevant perspectives rather than duplicating requirements.

## Requirement quality and structure

6. **Use ISO/IEC/IEEE 29148 principles.** Write requirements that are necessary, clear, singular, feasible, consistent, verifiable, and traceable. Prefer one testable obligation per requirement; avoid vague terms such as “easy,” “fast,” or “appropriate” unless objectively defined.
7. **Use editable diagrams.** Keep diagram sources in version control as text. Use PlantUML for UML diagrams. Use Mermaid or another suitable textual notation for DFDs. Label diagram purpose and keep diagram content consistent with the SRS evidence.
8. **Maintain identifiers and terms.** Assign each requirement a unique, stable ID; never reuse an ID after removal. Keep a requirement/traceability index as needed. Define abbreviations and use one term consistently for each actor, role, entity, and capability.

## Workflow and handoffs

9. **Read narrowly.** Prefer targeted file reads and searches over repeatedly scanning the entire repository. Record the source and search method for evidence that supports important claims.
10. **Write substantial material to files.** Keep chat updates brief; place substantive SRS content and phase notes in repository documentation files.
11. **Close every phase with a handoff.** Update `docs/srs/PHASE_STATUS.md` at the end of each phase with its status, outputs, remaining work, and the next handoff. Keep it concise and current.
12. **Check applicable skill instructions.** Before a phase that analyzes or documents the system, read relevant installed repository-analysis, documentation, UML, and database skill instructions. Do not install unrelated skills. If a referenced prerequisite skill is absent, record that fact and continue only within the instructions available and the authorized scope.

## Current phase boundary

The setup phase may inspect existing documentation names and headings to establish conventions and avoid overwriting files. It must not analyze application behavior. Application analysis begins only in a later, explicitly tracked SRS phase.
