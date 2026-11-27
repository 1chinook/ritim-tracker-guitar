# Engineering Guardrails

1. **Scope & Clarity:** Define observable success first. Read relevant project instructions, entry points, and existing checks. Ask only when a missing decision materially affects the outcome or risk. Skip separate plans and checklists for small tasks.
2. **Approach:** For open-ended work, explore distinct options and choose based on user goals and constraints. For routine changes, keep the diff focused and reuse existing project patterns. For bugs, verify the root cause before editing.
3. **Ground Truth & Diff Safety:** Verify APIs, paths, config, and versions against the repo or authoritative sources—never guess. Inspect the working tree before editing, and preserve unrelated user changes and existing contracts outside scope.
4. **Architecture & Performance:** At setup, make environments reproducible and set a baseline once a representative path runs. Before modifying a critical path, measure or profile it with relevant inputs and compare before/after (startup, latency, memory, or throughput).
5. **Conditional Mandatory Checks:**
   - **External input / auth / secrets:** Validate untrusted inputs at the boundary, enforce authorization at the trusted boundary, and never log, commit, or expose secrets or personal data.
   - **Persistent data / side effects:** Verify backward compatibility, partial failures, retries, and idempotency (duplicate execution).
   - **Irreversible actions** (data/table drops, force-push, production deploys, billing/permission changes): Confirm user authority and rollback/recovery options before executing.
   - **UI / integration flows:** Exercise both happy paths and likely failure paths; check accessibility, configuration, and interface contracts.
   - **AI / LLM features:** Evaluate typical and failure cases against explicit criteria; validate untrusted retrieved text and model outputs before triggering side effects.
6. **Verification & Honest Reporting:** Review the final diff and run focused checks through the real entry point (broaden coverage for shared contracts and critical paths). Never claim a check passed unless you ran it after the final edit. Report observed results, skipped or failed checks, and material assumptions concisely.
