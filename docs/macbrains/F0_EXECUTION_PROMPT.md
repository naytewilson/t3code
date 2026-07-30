# F0 Execution Prompt — Work Lane and Source-Truth Foundation

Copy this entire prompt to the first implementation agent after pulling the specification branch to the Mac.

---

Implement package `F0 — Work lane and source-truth contracts` in `naytewilson/t3code`.

## Authority

Read in order:

1. current repository/worktree state and scoped instruction files;
2. `AGENTS.md`;
3. `MACBRAINS.md`;
4. `docs/macbrains/README.md`;
5. `docs/macbrains/PROJECT_PROFILES.md` for the active project profile;
6. `docs/macbrains/DOMAIN_MODEL.md`;
7. F0 in `docs/macbrains/IMPLEMENTATION_LEDGER.md`;
8. `docs/macbrains/CAMPAIGN_MANIFEST.json`;
9. A/B/C/P rows applicable to F0 in `docs/macbrains/ACCEPTANCE_MATRIX.md`;
10. `docs/macbrains/AGENT_EXECUTION_PROMPT.md`.

Do not treat these documents as proof of current code. Inspect the real source and current branch.

## Continuous execution instruction

Proceed through inspection, plan, advisor review, implementation, tests, independent verification, commit, and package handoff without asking for routine confirmation. Stop only at a genuine blocker where a missing answer changes the correct action and cannot be resolved from repository/canonical evidence.

Do not open a pull request unless the task contract or repository owner explicitly authorizes it.

## Source-truth preflight

Before installing or editing, record:

```text
PROVEN TARGET
PROVEN REPOSITORY STATE
PROVEN INSTRUCTIONS AND AUTHORITIES
PROVEN BUILD AND TEST SURFACE
PROVEN RELEVANT FILES
OWNERSHIP OR OVERLAP RISKS
INFERRED
UNKNOWN THAT CHANGES ACTION
SAFE NEXT ACTION
```

At minimum verify:

- repository root/common Git dir;
- exact branch and HEAD;
- origin/upstream remotes without credentials;
- staged, unstaged, and untracked state;
- all worktrees and checked-out branches;
- active merge/rebase/cherry-pick/revert/bisect state;
- instruction hierarchy;
- package manager/toolchain/lockfiles;
- orchestration contract, decider, invariant, event, projector, persistence, migration, RPC, client-runtime, and test files;
- generated/vendored boundaries;
- any active agent ownership.

Use an isolated worktree. Never touch live `~/.t3/userdata` read-write. Never kill a process by pattern.

## F0 objective

Add a durable `WorkLane` and `SourceTruthRevision` foundation above existing projects/threads/provider sessions while preserving the event-sourced architecture.

The implementation must provide:

- lane/task-contract/acceptance/source-truth IDs and schemas;
- lane lifecycle state and validated transitions;
- commands and immutable events;
- pure decider invariants;
- deterministic projectors/read models;
- persistence and migration/replay support;
- compact shell/detail query boundaries;
- client-runtime decode/compatibility support where required;
- migration of existing threads without false completion;
- focused tests and documentation.

F0 does not implement the complete receipt store, checks engine, provider topology, command center, node runtime, or full UI. It must create stable integration boundaries for those packages.

## Domain requirements

### WorkLane

At minimum represent:

- stable lane ID;
- project ID;
- title;
- task contract;
- lifecycle state;
- priority/classification;
- environment association available from current architecture;
- repository identity;
- base ref/SHA where known;
- branch and worktree path;
- source-truth revision ID;
- active plan revision reference or reserved forward-compatible field only if current schema rules support it cleanly;
- acceptance criterion references or an F0-owned minimal representation;
- blocker references or a future-compatible boundary;
- created/updated/completed timestamps.

Do not store provider-specific runtime data inside WorkLane.

### TaskContract

At minimum represent:

- objective;
- constraints;
- non-goals;
- deliverable requirement;
- pull-request authorization;
- visible-surface requirement;
- authorized/prohibited action categories;
- completion-report requirement.

Use stable typed values. Do not persist arbitrary executable permission logic as unvalidated text.

### SourceTruthRevision

At minimum represent:

- stable revision ID and lane ID;
- repository identity/root;
- branch/detached state;
- HEAD/base SHA;
- worktree path;
- dirty fingerprint/status summary;
- instruction files in precedence order;
- manifests/build/test candidates;
- relevant file/test references;
- active Git operation state;
- worktree/ownership overlap result;
- canonical external source references where the existing architecture supports them;
- unknowns that change action;
- safe next action;
- produced timestamp and producer assignment/thread when available.

Large raw command output must be stored through an existing suitable artifact/log boundary or a forward-compatible reference. Do not bloat the shell projection.

## Lifecycle

Implement canonical states:

```text
queued
preflight
oriented
planned
executing
testing
reviewing
deliverable-ready
completed
blocked
failed
cancelled
superseded
recovery-required
```

F0 must enforce the documented transition matrix even before later packages fill all evidence requirements.

Temporary F0 transition policy:

- execution cannot start without a current source-truth revision;
- substantial lanes cannot execute without a worktree reference unless explicitly classified as a permitted exception;
- completed is not accepted until F2 supplies the full evidence gate; F0 should either reserve completion commands behind an explicit invariant or support imported historical state without pretending it meets the new completion contract;
- invalid states/events fail decoding or decision with actionable errors;
- commands are idempotent by command ID according to existing architecture.

Do not weaken later completion policy for convenience.

## Existing-thread migration

Migration must:

- preserve existing project/thread/message/activity/checkpoint/session data;
- create one imported lane per existing thread or another explicitly justified deterministic mapping;
- derive an objective from the earliest useful user message or title, labeling derivation quality as unknown/inferred where the domain supports it;
- preserve branch/worktree/checkpoint relationships;
- attach active provider session as future executor association only through a clean compatibility boundary;
- never mark historical threads completed under the new contract;
- place active/ambiguous imports into `queued` or `recovery-required` according to current durable state;
- be deterministic and replay-safe;
- include downgrade/rollback analysis even if automatic downgrade is not supported.

Do not mutate historical event facts merely to make the new projection easy.

## Contract organization

`packages/contracts/src/orchestration.ts` is already large. First inspect current explicit subpath conventions and package exports. Prefer focused new contract modules when consistent with current architecture:

- lane contracts;
- source-truth contracts;
- shared IDs/base schemas;
- RPC/query contracts.

One owner integrates shared export/wire changes. Do not create a second barrel if the package prohibits barrels.

## Persistence and projection

- Keep canonical events append-only.
- Make projections rebuildable.
- Preserve sequence semantics and reconnect behavior.
- Keep command-center/shell records compact; do not embed full task contracts/source-truth payloads unless justified by measured payload needs.
- Provide detail query/subscription for full lane state.
- Add schema versioning/compatibility transforms following current repository patterns.
- Do not invent JSON sidecars when the current event/SQLite architecture is the correct authority.

## Advisor requirement

Before broad edits, launch an independent architecture advisor with read-only access. Give it:

- current preflight;
- inspected source map;
- proposed aggregate boundaries;
- migration strategy;
- compatibility/query strategy;
- planned files and tests;
- risks and alternatives.

The advisor must explicitly approve, constrain, or reject. Record the response. Revise before implementation if rejected.

## Focused tests

At minimum cover:

- schema roundtrip and invalid decoding;
- every allowed and disallowed lane transition;
- command idempotency;
- no-execution-without-preflight;
- substantial-no-worktree refusal;
- project/thread/lane relationship invariants;
- source-truth revision append/supersession behavior;
- projection replay determinism;
- shell/detail projection shape and payload boundary;
- migration of empty, normal, archived, active, failed/interrupted, worktree, checkpointed, and malformed legacy fixtures;
- reconnect/subscription compatibility where touched;
- no false historical completion.

Use receipts/worker drains/deterministic clocks following repository conventions. Do not use arbitrary sleeps or polling.

## Verification

Run only commands proven by current manifests/instructions. Include:

- focused formatter/lint for touched files;
- focused contract/server/client-runtime typecheck;
- focused tests;
- migration/replay tests;
- build of affected packages if required by current project scripts.

After implementation:

1. inspect staged and unstaged diff;
2. inspect generated files and package exports;
3. rerun checks after any fix;
4. launch an independent verifier;
5. verifier refreshes source truth and reviews current source, tests, migration, diff, and F0 acceptance rows;
6. fix all real findings;
7. commit with a focused conventional message;
8. provide branch/commit and package handoff.

Do not mark a check passed if it was skipped, stale, or run before the final change.

## Required final output

```text
PACKAGE: F0
BRANCH:
WORKTREE:
BASE SHA:
FINAL SHA:
FILES CHANGED:
MIGRATION:
COMMAND RECEIPTS:
CHECK RECEIPTS:
ADVISOR RECEIPT:
VERIFIER RECEIPT:
ACCEPTANCE ROWS PROVEN:
ACCEPTANCE ROWS STILL MISSING:
DEPENDENCIES UNBLOCKED:

proven:
missing evidence:
possibly wrong or overstated:
exact next action:
what does not count as completion:
safe to continue here or start a fresh context:
```

A documentation update, schema-only stub, mock UI, or tests without integrated persistence/projection behavior does not complete F0.

---