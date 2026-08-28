# MacBrains Project Profiles

## Purpose

These profiles adapt the generic lane model to Nayte's actual repositories and recurring work. They are policy templates, not proof that a path, branch, service, database, or experiment is current. Project onboarding must verify the real checkout, Git state, canonical records, and connected environments before applying a profile.

The UI should let a project inherit one profile and then show every effective override.

## Common rules for all profiles

- Run read-only source-truth preflight before planning or editing.
- Use an isolated worktree for substantial changes.
- Keep executor, advisor, verifier, child, and recovery assignments visible.
- Use the smallest sufficient model; normal implementation defaults to medium reasoning.
- Require independent advice for architecture, persistence, concurrency, security, performance, migrations, destructive operations, or conflicting evidence.
- Do not use a passing build as a substitute for acceptance.
- Do not mark backend work complete without a visible launch/access path when the project has a user-facing surface.
- Record exact commands, outputs, diffs, checks, staged files, and current commit.
- No Python implementation or worker automation on the Linux node.

## Profile: ANE-RE

### Identity hints

- Logical project: `ANE-RE`
- Known Mac checkout hint: `/Users/nayte/Projects/ane-re`
- Known GitHub identity: `naytewilson/ane-re`
- A GitLab mirror may exist.

Treat every path/remote as unstable until preflight verifies it.

### Mission

Research, measure, and implement real Apple Neural Engine placement, compiler, runtime, emitter, token-generation, and performance advances without converting hypotheses into claims.

### Canonical authority order

1. Current repository and scoped instructions.
2. Current experiment ledger/manifests and designated canonical campaign records.
3. Raw measurement artifacts, environment captures, generated models, traces, and independent recomputation receipts.
4. Current CI/build/test output.
5. Durable handoffs.
6. Conversation narrative.

### Required lane types

- Experiment design
- Harness implementation
- Compiler/emitter implementation
- Runtime investigation
- Placement verification
- Performance confirmation
- Independent recomputation
- Integration/review
- Recovery of partial campaign

### Experiment contract

Every experiment lane records:

- exact hypothesis and falsification condition;
- baseline and candidate commits;
- hardware, OS/build, frameworks, power/thermal state, and relevant environment;
- generated model/artifact hashes;
- command lines and repetitions;
- correctness gates before performance claims;
- ANE placement/residency evidence method;
- warmup, sample count, variance, and outlier policy;
- raw and summarized results;
- independent recomputation environment;
- verdict vocabulary and superseded prior claims.

No percentage, token rate, speedup, placement, residency, or correctness claim is `PROVEN` without raw artifacts tied to the exact revision.

### Environment policy

- Apple-hardware-dependent ANE compilation/runtime validation runs on the Mac or another explicitly supported Apple environment.
- Linux node may perform native compiled CPU work, statistics implemented without Python, data validation, artifact hashing, and independent recomputation where semantically valid.
- Cloud compute follows the project's current canonical provider and manifest; historical providers are not assumed current.
- Node results are not ANE placement proof.

### Ownership policy

Parallel experiment lanes may share immutable inputs but must not edit the same harness, generator, manifest, or canonical verdict registry concurrently. Designate one integration owner for shared experiment schemas and ledgers.

### Completion

A campaign closes only with:

- correctness result;
- placement/residency result when claimed;
- performance result with measurement floor respected;
- raw artifact bundle;
- independent review/recomputation;
- canonical ledger update;
- exact integration commit or explicit falsified/no-change verdict.

## Profile: ANVIL

### Identity hints

- Logical project: `ANVIL`
- Known Mac checkout hint: `/Users/Nayte/ANVIL`
- Primary implementation language: Swift, with native compiled helpers where needed.

Always write `ANVIL` uppercase except exact case-sensitive identifiers, commands, and paths.

### Mission

Operate ANVIL as an OS-like durable orchestration system with source-truth-first package execution, crash recovery, worker isolation, resource-aware scheduling, event-driven dispatch, verification, and visible user control.

### Canonical authority order

1. Current repository and `AGENTS.md`/project instructions.
2. Canonical Postgres records, package ledger, manifests, receipts, and designated decision tables.
3. Current Git/worktree state.
4. Current tests/build output.
5. Durable handoffs.
6. Conversation narrative.

### Default package execution flow

1. Read repository instructions.
2. Read the command center/current authoritative runbook.
3. Load the current completion/package manifest.
4. Select the next executable package from canonical state.
5. Emit a source-truth preflight record.
6. Execute only the selected package in an isolated worktree.
7. Produce receipts and focused verification.
8. Integrate or open the authorized PR.
9. Update canonical state.
10. Continue to the next executable package only when ownership/dependencies permit.

Do not select work from remembered conversation when canonical package state is available.

### Linux node policy

- No Python implementation, scripts, or worker prompts.
- Prefer C, C++, Rust, Swift where supported, shell, or another native compiled language.
- Pin source commit and input hashes.
- Return content-addressed artifacts and logs.
- Mac integration and verification are separate events.
- Postgres access follows current network, role, and read/write policy; never assume broad database authority.

### Agent topology

- Executor: normal package implementation.
- Advisor: architecture/state-machine/persistence/concurrency/security decisions.
- Verifier: current source, tests, receipts, DB/ledger consistency, and final diff.
- Recovery agent: stale or contradicted executor context.
- Child workers: bounded math, tests, or independent validation with explicit ownership.

### Completion

ANVIL package completion requires:

- canonical package state updated;
- exact source-truth receipt;
- tests and build on current commit;
- final diff/staged list;
- database/migration verification where applicable;
- visible control/status surface when user-facing;
- no unresolved ownership or package dependency conflict.

## Profile: MacBrains native product

### Mission

Build persistent local intelligence and user-facing Mac software that is obvious to launch, continuously useful, resource-aware, and visible across Mac and mobile control surfaces.

### Technical preference

- Prefer native Swift/SwiftUI/AppKit/Foundation and native compiled helpers for long-running Mac services.
- Electron/React may remain where inherited by T3 Code, but fork additions must respect performance and avoid duplicating native OS responsibilities unnecessarily.
- Use launchd/FSEvents/AXUIElement and platform APIs only with explicit lifecycle, sandbox, entitlement, accessibility, and privacy review.

### Delivery invariant

Backend implementation is never enough. Every feature needs:

- obvious navigation or launch action;
- persistent status after restart;
- real attention notifications where applicable;
- exact access path from desktop and mobile when applicable;
- end-to-end acceptance evidence that Nayte can see and use.

### Completion

Include packaged/local launch path, persistence/restart test, accessibility review, resource-use evidence, and visible acceptance receipt.

## Profile: NeoDSP and native macOS system components

### Mission

Develop native macOS audio, driver, HAL, service, and system integration safely and with platform-specific review.

### Required advisor/verifier specialties

- Swift/macOS concurrency and lifecycle;
- Core Audio/HAL behavior;
- sandbox, entitlements, signing, notarization;
- memory/resource ownership;
- real-time thread safety;
- accessibility and user control;
- installation/uninstallation rollback.

### Hard gates

- No allocation, blocking, logging, or unsafe synchronization on real-time audio paths unless explicitly proven safe.
- No entitlement or signing assumptions.
- System installation has exact rollback and coexistence tests.
- Packaged behavior must be tested outside the IDE.

## Profile: Sieve and security-sensitive tooling

### Mission

Build observable local security/network tooling without hiding interception, trust, credentials, or ownership boundaries.

### Required gates

- Advisor and verifier required.
- Explicit threat model and data-handling contract.
- No silent certificate, proxy, trust-store, traffic, or credential changes.
- Reversible setup/uninstall.
- Secrets never enter receipts or UI payloads.
- End-to-end test proves the visible dashboard matches real runtime ownership.

## Profile: Frontier Atlas and web dashboards

### Mission

Deliver a fast, evidence-backed visual dashboard rather than a disconnected static frontend.

### Required behavior

- data provenance visible;
- stale/current state explicit;
- large lists virtualized;
- no continuously repainting animation;
- mobile-responsive control where useful;
- backend/API and frontend contract tested together;
- deployment or local launch path included.

## Profile: IFAR and research architecture initiatives

### Mission

Explore high-upside ANE/model architecture ideas while keeping explorer creativity separate from canonical proof.

### Topology

- Explorer: preserves continuity and generates hypotheses/designs.
- Canonical verifier: independently validates math, source constraints, measurements, and implementability.
- Executor: implements only accepted bounded candidates.
- Performance verifier: tests correctness, placement, and measurement reliability.

Do not interrupt the explorer with constant source policing, but do not promote explorer claims into project truth without independent verification.

## Profile: CPU/GPU/benchmark campaigns

### Required contract

- baseline commit and environment;
- workload definition and inputs;
- correctness oracle;
- warmup/sample/variance plan;
- thermal/power/resource telemetry;
- cancellation and partial-output semantics;
- raw results preserved throughout;
- final verdict distinguishes partial, falsified, inconclusive, and proven.

A stopped soak with partial CSVs is not a finished campaign and must remain visibly partial.

## Profile: Imported or unfamiliar repository

Use this when no named profile applies.

1. Inspect repository and instructions.
2. Detect language/build/test surfaces from actual files.
3. Identify user-visible product surface.
4. Establish source of truth and ownership.
5. Select the smallest applicable workflow template.
6. Persist a project-specific profile proposal as `INFERRED`.
7. Advisor reviews before broad architecture changes.

Do not force ANE-RE or ANVIL conventions onto unrelated repositories.

## UI implementation requirements

Project settings must display:

- selected profile and version;
- path/remote hints versus verified current values;
- source-authority order;
- default lane templates;
- default topology/model intent;
- environment/node policy;
- required receipts and checks;
- delivery invariant;
- project-specific prohibited actions;
- effective overrides and origin.

A lane creation form should recommend a profile-derived template but allow explicit override. Every override is recorded in the task contract.