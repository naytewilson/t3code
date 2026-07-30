# MacBrains T3 Code Continuous Implementation Topology

## Goal

Run the entire overhaul as one continuous dependency graph without repeated human phase approvals, while preventing overlapping edits, hidden subagents, stale integration, and false completion.

This plan does not authorize implementation in the specification branch. Each editing lane uses its own isolated worktree and focused branch. The integration owner advances a dedicated integration branch and only merges current, verified package results.

## Roles

### Campaign integrator

Owns:

- current integration branch;
- package dependency/status reconciliation;
- shared contract integration order;
- cross-lane conflict resolution;
- invalidation of stale checks;
- acceptance matrix evidence links;
- final E0 acceptance bundle.

The integrator does not casually implement package code. It protects source truth and merge order.

### Package executor

Owns one bounded package or a declared sequence within one ownership group. It runs preflight, implements, tests, and produces receipts.

### Architecture advisor

Reviews the oriented plan before broad/high-risk edits. It has read access to current source and package contract but does not share the executor's editing ownership.

### Package verifier

Independently refreshes source truth after implementation, reviews current diff/checks/receipts, and accepts or rejects package completion.

### Recovery executor

Replaces a failed or anchored executor context using a canonical handoff. It does not erase the prior assignment or continue from unverified prose alone.

## Branch and worktree naming

Use stable package identifiers:

```text
macbrains/f0-work-lane-contracts
macbrains/f1-receipt-evidence
macbrains/f2-completion-gate
macbrains/f3-agent-topology
macbrains/f4-worktree-ownership
macbrains/f5-command-center
macbrains/f6-lane-surfaces
macbrains/p0-provider-normalization
macbrains/p1-background-leases
macbrains/p2-context-recovery
macbrains/n0-environment-node-policy
macbrains/n1-node-runtime
macbrains/n2-artifact-integration
macbrains/r0-atomic-persistence
macbrains/r1-heavy-thread-resilience
macbrains/d0-deliverables
macbrains/d1-ui-acceptance
macbrains/d2-notifications
macbrains/g0-source-control
macbrains/s0-instruction-skill-registry
macbrains/u0-fork-identity
macbrains/u1-policy-settings
macbrains/v0-performance
macbrains/e0-acceptance
```

Append a date or agent identifier only when necessary to avoid a real collision. Do not create multiple branches for the same package without recording which supersedes which.

## Continuous execution lanes

### Lane A — Domain foundation

Packages:

- F0 Work lane and source-truth contracts
- F1 Typed receipt/evidence substrate
- F2 Checks and completion gate

Ownership:

- lane/source-truth/check/receipt contracts;
- decider/invariants/projectors for those aggregates;
- persistence migrations;
- focused client-runtime compatibility types;
- tests for lifecycle, migration, receipt, and completion.

Serialization rule: F0 -> F1 -> F2. Do not split these shared orchestration files among simultaneous editors.

Advisor checkpoints:

- F0 schema/migration design;
- F1 artifact/receipt storage boundary;
- F2 completion/staleness invariant.

### Lane B — Agent and provider lifecycle

Packages:

- F3 Agent assignments/topology
- P0 Provider normalization
- P1 Background leases/session reaper
- P2 Context health/recovery

Starts after F0 contracts are integrated. It may inspect earlier but must not commit against invented lane APIs.

Ownership:

- assignment contracts/projectors;
- provider-normalized lifecycle/capabilities;
- child-agent visibility;
- activity leases;
- compaction/context epochs;
- recovery handoff and provider switch.

Provider sub-specialists may review individual adapters, but one provider-lane owner integrates shared adapter contracts.

### Lane C — Git, worktrees, and source control

Packages:

- F4 Worktree/ownership manager
- G0 GitHub/source-control integration

Starts after F0.

Ownership:

- Git/worktree services and contracts;
- lane bootstrap;
- ownership/overlap index;
- remote project/worktree operations at the server boundary;
- change-request adapters and evidence;
- authenticated private clone/onboarding;
- remote parser fixes.

Must coordinate with Lane D on remote environment RPC and Lane F on UI, without sharing files casually.

### Lane D — Environments and Linux node

Packages:

- N0 Environment/node capability and policy
- N1 Node job runtime
- N2 Artifact return and Mac integration

Starts N0 after F0; N1 after F1 and N0; N2 after F2 and N1.

Ownership:

- environment capability schemas;
- node policy validation;
- job state machine;
- native-command dispatch;
- immutable inputs/outputs;
- authenticated/resumable artifact transfer;
- Mac integration receipts.

Hard rule: no Python implementation, generated worker script, or node prompt.

### Lane E — Persistence and resilience

Packages:

- R0 Atomic persistence/last-known-good recovery
- R1 Projection/heavy-thread resilience

R0 starts after F1 receipt/artifact storage boundaries are stable. R1 follows R0 and coordinates with Lane A projection changes.

Ownership:

- critical catalog persistence;
- corruption diagnostics/recovery;
- projection rebuild/isolation;
- large thread/log/diff storage boundaries;
- memory/CPU resilience tests.

### Lane F — Shared client runtime and Command Center

Packages:

- F5 Command Center/projections

Starts after F0-F3 provide stable shell contracts.

Ownership:

- compact command-center projection contracts;
- client-runtime services/atoms/presentation;
- cache/reconnect behavior;
- cross-environment lane summaries;
- list virtualization primitives shared by clients.

Do not add provider or Git logic to React components.

### Lane G — Web, desktop, mobile, delivery, settings

Packages:

- F6 Lane detail/cross-surface controls
- D0 Deliverables
- D1 UI acceptance
- D2 Notifications
- U1 Settings/policy editor

Starts incrementally after its contract dependencies integrate. Split platform-specific sub-lanes only with explicit ownership:

- shared/client-runtime owner;
- web/desktop owner;
- mobile owner;
- notification platform owner.

All applicable surfaces must converge on the same domain state and action semantics.

### Lane H — Fork identity and release isolation

Packages:

- U0 Branding/fork identity

May begin early because it has few domain dependencies, but it must not alter shared release/config files concurrently with Lane G or final integration without coordination.

Ownership:

- identity manifest;
- product/package/app/service/data IDs;
- update feed/package publication isolation;
- hosted service defaults;
- import/migration from upstream profile;
- branding assets and release documentation.

Default to local/private-only until MacBrains-owned hosted resources are proven.

### Lane I — Performance and final verification

Packages:

- V0 Performance/telemetry hardening
- E0 End-to-end acceptance

V0 starts after F5 and R1. E0 waits on every declared dependency.

Ownership:

- seeded performance/idle soaks;
- payload and UI-thread profiling;
- telemetry correlation;
- full Mac + Linux node + mobile scenario;
- restart, provider failure, stale evidence, and recovery scenarios;
- final release evidence bundle.

This lane is an independent verifier, not the author of every performance fix. It reports regressions back to the owning lane.

## Parallelism rules

Parallel execution is allowed only when:

- package dependencies are satisfied in the integration branch;
- source paths/symbols are disjoint or a shared-file merge contract exists;
- each branch has a unique worktree;
- each lane records the current integration base SHA;
- package checks are rerun after rebasing/integration;
- no lane treats another lane's unmerged contract as canonical.

Pause a lane automatically when:

- its base is superseded by a breaking schema change;
- another active lane acquires overlapping ownership;
- source authorities conflict;
- required advisor rejects the plan;
- required environment/provider is unavailable;
- a migration or destructive operation cannot be proven safe.

Do not pause for routine stylistic uncertainty or because a provider asks for confirmation that the task contract already grants.

## Integration loop

The integrator repeats:

1. Refresh fork main/spec/integration/upstream refs.
2. Read `CAMPAIGN_MANIFEST.json` and current receipts.
3. Identify the earliest ready candidate package.
4. Verify package branch base, ownership, current source truth, and checks.
5. Require package verifier acceptance.
6. Integrate using the repository's current safe strategy.
7. Rerun checks invalidated by integration.
8. Update package status and acceptance evidence.
9. Notify newly unblocked lanes.
10. Continue immediately.

No human phase approval is required between packages unless an irreversible decision is outside the existing contract.

## Model routing intent

Use capability intent rather than hard-coded model names:

- mechanical worker: bounded deterministic edits/checks, light reasoning;
- executor: normal implementation, medium reasoning;
- advisor: architecture/risk review, stronger independent reasoning;
- verifier: independent source/diff/evidence review, stronger independent reasoning;
- explorer: continuity for open-ended research;
- recovery: fresh medium-or-strong context selected from failure evidence.

Prefer free, flat-rate, subscription, or local capacity before pay-per-token when capability is sufficient. Record every concrete resolution and escalation cause.

## Agent launch packet

Every launched agent receives:

- exact fork/repository and target branch;
- isolated worktree path;
- current integration base SHA;
- package ID and ownership boundary;
- applicable project profile and workflow template;
- authoritative document list;
- acceptance row IDs;
- allowed/prohibited actions;
- required advisor/verifier assignment;
- exact output/receipt contract;
- known active neighboring lanes and shared files.

Do not send the entire campaign as an unbounded prompt to every child agent. Give each agent enough context to execute its package and link to the canonical documents.

## Campaign state updates

Because GitHub Issues are disabled, update:

- `CAMPAIGN_MANIFEST.json` package status;
- `IMPLEMENTATION_LEDGER.md` package evidence;
- `ACCEPTANCE_MATRIX.md` row evidence;
- package receipts/artifacts in the product's evidence store when implemented;
- `IMPLEMENTATION_HANDOFF.md` only when the campaign-level handoff materially changes.

All status edits require proof on current revisions. Do not mark `PROVEN` manually from an executor summary.

## Final completion

The campaign integrator may request final completion only when:

- all required packages are `PROVEN`;
- no acceptance evidence is stale;
- fork identity and release isolation are proven;
- E0 passes on Mac, Linux node, desktop/web/iPhone/iPad as applicable;
- restart, provider failure, node disconnect, corrupt optional state, and stale evidence recovery are demonstrated;
- the final deliverable is visible and launchable;
- an independent verifier accepts the complete evidence bundle.