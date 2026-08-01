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
9. [`ORCHESTRATION_PLAN.md`](./ORCHESTRATION_PLAN.md) — continuous multi-agent topology, ownership lanes, integration loop, and no-routine-confirmation execution model.
10. [`WORKFLOW_TEMPLATES.json`](./WORKFLOW_TEMPLATES.json) — reusable feature, bug, review, research, experiment, recovery, ANVIL, ANE-RE, native macOS, and artifact workflows.
11. [`ACCEPTANCE_MATRIX.md`](./ACCEPTANCE_MATRIX.md) — proof required before any package or release is complete.
12. [`DEFAULT_POLICIES.json`](./DEFAULT_POLICIES.json) — machine-readable initial policy intent.
13. [`FORK_IDENTITY_AND_RELEASE.md`](./FORK_IDENTITY_AND_RELEASE.md) — application, data, service, hosted-control-plane, and updater isolation from upstream.
14. [`PULL_TO_MAC.md`](./PULL_TO_MAC.md) — safe fetch, worktree, verification, integration, and cleanup instructions for the Mac.
15. [`IMPLEMENTATION_HANDOFF.md`](./IMPLEMENTATION_HANDOFF.md) — exact campaign handoff, evidence gaps, first package ownership, and stop conditions.
16. [`F0_EXECUTION_PROMPT.md`](./F0_EXECUTION_PROMPT.md) — complete launch prompt for the first implementation package.
17. [`AGENT_EXECUTION_PROMPT.md`](./AGENT_EXECUTION_PROMPT.md) — root prompt for all implementation agents.
18. [`FAMILY_EXECUTION_BOARD.md`](./FAMILY_EXECUTION_BOARD.md) — Nayte-approved family waves and product milestone.
19. [`FAMILY_OWNERSHIP.md`](./FAMILY_OWNERSHIP.md) — active lanes, worktrees, shared-file rule, and path ownership.
20. [`WORKER_LAUNCH_PACKETS.md`](./WORKER_LAUNCH_PACKETS.md) — Worker A/B/C launch contracts for Wave 1.
21. [`receipts/WAVE0_CONTROL.md`](./receipts/WAVE0_CONTROL.md) — Wave 0 control checklist receipt.
22. [`receipts/WAVE0_INTEGRATOR.md`](./receipts/WAVE0_INTEGRATOR.md) — Wave 0 integrator evidence.

## Canonical status

The repository and current tool output remain authoritative. These documents define intent and acceptance but do not prove current implementation state.

## Current family target

Wave 0 establishes control on baseline `57b800cd3` / branch `macbrains/integration`. Active Wave 1 packages:

- Worker A — F2 truthful completion gate
- Worker B — F3 director/worker assignments + real provider spawning
- Worker C — F5/F6 visible Projects + agent-tree vertical slice

Read `FAMILY_OWNERSHIP.md` before editing. Do not work in primary `main`.

## First implementation target (historical)

F0 work-lane/source-truth contracts were the original first package (`F0_EXECUTION_PROMPT.md`). F0 is present on baseline `57b800cd3` as `IMPLEMENTED_UNVERIFIED` pending independent verification. New workers start from the family board above, not by re-opening primary `main`.

## Specification validation

Run from the repository root:

```sh
node scripts/validate-macbrains-spec.mjs
```

This validates required files, JSON syntax, package IDs/status/dependencies/cycles, workflow templates, default policy invariants, contract markers, acceptance sections, and index coverage. It does not validate product implementation.

## Campaign tracking

GitHub Issues are disabled in this fork, so the authoritative implementation tracker is `CAMPAIGN_MANIFEST.json`, the detailed package contract in `IMPLEMENTATION_LEDGER.md`, and the evidence fields in `ACCEPTANCE_MATRIX.md`. Do not maintain a conflicting private checklist.

## Campaign completion

The campaign is complete only after every required acceptance row is `PROVEN` on current revisions and the E0 canonical Mac + Linux node + mobile scenario passes with a restart/recovery evidence bundle.