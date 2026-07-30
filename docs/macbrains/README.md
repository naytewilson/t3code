# MacBrains T3 Code Specification Index

Read in this order:

1. [`../../MACBRAINS.md`](../../MACBRAINS.md) — non-negotiable operating contract.
2. [`FORK_BASELINE.md`](./FORK_BASELINE.md) — verified initial architecture and limitation inventory; re-verify before acting.
3. [`DOCUMENTATION_AUDIT.md`](./DOCUMENTATION_AUDIT.md) — documentation coverage, contradictions, operational constraints, and issue-backed risk register.
4. [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) — complete product behavior and UX.
5. [`PROJECT_PROFILES.md`](./PROJECT_PROFILES.md) — ANE-RE, ANVIL, MacBrains, NeoDSP, Sieve, Frontier Atlas, IFAR, and campaign-specific policy profiles.
6. [`DOMAIN_MODEL.md`](./DOMAIN_MODEL.md) — commands, events, aggregates, receipts, and invariants.
7. [`IMPLEMENTATION_LEDGER.md`](./IMPLEMENTATION_LEDGER.md) — dependency-ordered implementation packages.
8. [`CAMPAIGN_MANIFEST.json`](./CAMPAIGN_MANIFEST.json) — machine-readable dependencies, ownership groups, status, and release gate.
9. [`WORKFLOW_TEMPLATES.json`](./WORKFLOW_TEMPLATES.json) — reusable feature, bug, review, research, experiment, recovery, ANVIL, ANE-RE, native macOS, and artifact workflows.
10. [`ACCEPTANCE_MATRIX.md`](./ACCEPTANCE_MATRIX.md) — proof required before any package or release is complete.
11. [`DEFAULT_POLICIES.json`](./DEFAULT_POLICIES.json) — machine-readable initial policy intent.
12. [`FORK_IDENTITY_AND_RELEASE.md`](./FORK_IDENTITY_AND_RELEASE.md) — application, data, service, hosted-control-plane, and updater isolation from upstream.
13. [`PULL_TO_MAC.md`](./PULL_TO_MAC.md) — safe fetch, worktree, verification, integration, and cleanup instructions for the Mac.
14. [`IMPLEMENTATION_HANDOFF.md`](./IMPLEMENTATION_HANDOFF.md) — exact campaign handoff, evidence gaps, first package ownership, and stop conditions.
15. [`AGENT_EXECUTION_PROMPT.md`](./AGENT_EXECUTION_PROMPT.md) — root prompt for implementation agents.

## Canonical status

The repository and current tool output remain authoritative. These documents define intent and acceptance but do not prove current implementation state.

## First implementation target

Start with `F0 — Work lane and source-truth contracts`. Do not begin disconnected UI work. The first agent must:

- create an isolated worktree from the current fork target branch;
- run source-truth preflight;
- inspect existing orchestration contracts, decider, invariants, projector, projection persistence, migrations, client-runtime models, and focused tests;
- define an ownership boundary that avoids parallel edits to shared contract files;
- obtain independent architecture advice before changing persistence/domain schemas;
- implement the full F0 vertical slice with migration and focused proof.

## Campaign tracking

GitHub Issues are disabled in this fork, so the authoritative implementation tracker is `CAMPAIGN_MANIFEST.json`, the detailed package contract in `IMPLEMENTATION_LEDGER.md`, and the evidence fields in `ACCEPTANCE_MATRIX.md`. Do not maintain a conflicting private checklist.

## Campaign completion

The campaign is complete only after every required acceptance row is `PROVEN` on current revisions and the E0 canonical Mac + Linux node + mobile scenario passes with a restart/recovery evidence bundle.