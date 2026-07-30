# MacBrains T3 Code Specification Index

Read in this order:

1. [`../../MACBRAINS.md`](../../MACBRAINS.md) — non-negotiable operating contract.
2. [`FORK_BASELINE.md`](./FORK_BASELINE.md) — verified initial architecture and limitation inventory; re-verify before acting.
3. [`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md) — complete product behavior and UX.
4. [`DOMAIN_MODEL.md`](./DOMAIN_MODEL.md) — commands, events, aggregates, receipts, and invariants.
5. [`IMPLEMENTATION_LEDGER.md`](./IMPLEMENTATION_LEDGER.md) — dependency-ordered implementation packages.
6. [`ACCEPTANCE_MATRIX.md`](./ACCEPTANCE_MATRIX.md) — proof required before any package or release is complete.
7. [`DEFAULT_POLICIES.json`](./DEFAULT_POLICIES.json) — machine-readable initial policy intent.
8. [`AGENT_EXECUTION_PROMPT.md`](./AGENT_EXECUTION_PROMPT.md) — root prompt for implementation agents.

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

## Campaign completion

The campaign is complete only after every required acceptance row is `PROVEN` on current revisions and the E0 canonical Mac + Linux node + mobile scenario passes with a restart/recovery evidence bundle.