# MacBrains T3 Code Product Specification

## Product definition

MacBrains T3 Code is the persistent, multi-environment operating surface for repository-grounded agent work. It coordinates human direction, source-truth inspection, isolated implementation lanes, provider sessions, Linux-node execution, verification, and visible delivery across desktop, web, iPhone, and iPad.

The product must answer, at all times:

1. What work exists?
2. Which repository, branch, worktree, environment, and source of truth own it?
3. Which agent is doing what, with which model and tools?
4. What has actually happened?
5. What evidence proves the result?
6. What needs Nayte's attention?
7. How does the finished work become visible and usable?

## Design principles

### Evidence before narrative

Repository state, GitHub, CI, canonical databases, manifests, ledgers, and command receipts outrank conversation history. The UI presents evidence next to claims and never collapses `INFERRED` into `PROVEN`.

### One obvious surface

The default home is a work command center, not an empty chat view. It shows projects, active lanes, blockers, completed deliverables, node jobs, review status, and attention items.

### Durable by default

Runs, plans, receipts, artifacts, checkpoints, agent relationships, and user decisions survive process restarts and device changes. Recovery is an ordinary state transition, not an exceptional manual ritual.

### Isolation without invisibility

Every substantial editing lane gets a worktree, but all lanes remain visible together. Worktree isolation must reduce collisions without fragmenting awareness.

### Advisors at leverage points

Independent advice is inserted after orientation, when evidence conflicts or strategy changes, and before completion. Advisors do not become hidden parallel implementers.

### Completion means usable

A backend result without a visible surface, launch path, notification path, and end-to-end acceptance receipt is incomplete.

### Remote control is first-class

Mobile and web are not read-only dashboards. They can create projects, start and steer runs, approve actions, inspect evidence, recover work, and open outputs.

## Primary navigation

### Command Center

Default landing surface. Sections:

- **Needs attention**: approvals, blockers, failed checks, evidence conflicts, stale lanes, merge conflicts, missing deliverables.
- **Active work**: every executing or waiting lane across environments.
- **Ready for review**: finished implementation awaiting verifier or human review.
- **Ready to use**: validated outputs with launch/access actions.
- **Recent evidence**: tests, CI, benchmarks, receipts, and source-truth changes.
- **Node activity**: Linux-node jobs, resource status, artifacts, and return-to-Mac integration status.

Each card must show project, lane, environment, agent role, provider/model, current lifecycle state, elapsed active time, last durable receipt, and next action.

### Projects

Project pages aggregate all environments and clones belonging to one logical repository identity.

Required tabs:

- Overview
- Work lanes
- Source truth
- Plans
- Changes
- Checks
- Pull requests
- Experiments
- Artifacts
- Decisions
- Activity
- Settings

A project may have local Mac and remote Linux clones. They are distinct environment-local workspaces linked by repository identity.

### Work

Cross-project lane browser with filters for state, role, model, provider, environment, branch, worktree, owner, and attention status.

### Environments

Shows Mac, Linux node, and future hosts. Each environment page exposes:

- reachability and authentication;
- Tailscale/LAN/SSH/tunnel endpoints;
- server and client version compatibility;
- provider instances and authentication state;
- repositories and worktrees;
- CPU, memory, disk, thermal, and active process telemetry;
- background-service status;
- recent failures and recovery controls.

### Deliverables

A persistent library of finished outputs: applications, dashboards, builds, DMGs, AppImages, reports, benchmark bundles, PRs, patches, datasets, and launch URLs. Each deliverable includes provenance and acceptance receipts.

## Work lane creation

The new-work composer must support:

- project and environment selection;
- existing branch or new branch;
- isolated worktree by default for substantial work;
- task contract and acceptance criteria;
- executor provider/model/reasoning;
- advisor provider/model/reasoning;
- verifier provider/model/reasoning;
- tool permissions;
- runtime access policy;
- node-offload policy;
- notification policy;
- explicit ownership paths when parallel work is enabled.

Provide templates:

- Implement feature
- Fix bug
- Review PR
- Repository audit
- Research and design
- Experiment/benchmark
- Recovery/resume
- Documentation/artifact
- ANVIL package execution

Templates preconfigure contracts but do not hide them.

## Lifecycle UX

### Queued

The task is persisted but not executing. Show environment availability, dependencies, and estimated scheduling order without inventing duration estimates.

### Preflight

Display repository root, current branch/HEAD, status, worktrees, remotes, instruction files, manifests, relevant tests, and overlap risks. The lane may not edit until the preflight receipt is accepted by orchestration.

### Oriented

The executor has read the relevant implementation and tests. Show source files inspected, symbols identified, and unknowns that change action.

### Planned

Show an executable plan tied to acceptance criteria and file ownership. Plans are versioned. Strategy changes create a new plan revision with rationale.

### Executing

Show live agent transcript, tool calls, changed files, resource usage, child agents, node jobs, and durable progress receipts. Provide `steer`, `queue`, `interrupt`, `pause`, and `handoff` controls.

### Testing

Checks render as structured entities, not transcript text. Each check records environment, command, scope, start/end timestamps, exit status, log artifact, and related commit/worktree state.

### Reviewing

The verifier receives the task contract, final diff, receipts, test results, and known risks. It must independently inspect current source rather than trust the executor summary.

### Deliverable ready

The implementation passed technical checks but completion waits for a visible launch/access path and end-to-end acceptance evidence.

### Completed

The UI shows the final completion report, deliverable actions, exact commit/PR, verified checks, unresolved caveats, and where the work appears in the user's daily workflow.

### Blocked and recovery required

Blockers are typed:

- missing access/authentication;
- source conflict;
- dirty or overlapping ownership;
- dependency unavailable;
- failed invariant;
- test/build failure;
- environment offline;
- provider failure;
- corrupted persisted state;
- context exhaustion;
- user decision genuinely required.

Recovery offers evidence-based actions: resume same provider, switch provider while preserving state, create recovery agent, restore checkpoint, recreate session, retry node job, or fork a clean lane.

## Agent topology visualization

Represent agents as a directed graph:

- executor owns the lane;
- advisor attaches to a plan revision or escalation point;
- verifier attaches to a candidate completion;
- child workers attach to bounded tasks and declared ownership;
- recovery agents supersede failed contexts without erasing history.

Every node shows provider instance, model, reasoning level, context status, tool access, environment, timestamps, and outcome. No invisible subagents.

## Source-truth panel

For every lane, expose a persistent panel containing:

- repository and canonical root;
- branch, HEAD, base SHA, upstream divergence;
- worktree path and status;
- instruction hierarchy;
- canonical project records and connected sources;
- relevant files and symbols;
- generated/vendored boundaries;
- active operations such as merge/rebase/cherry-pick;
- ownership collisions;
- staleness warnings.

Users can pin sources as authoritative. The system records conflicts rather than silently choosing.

## Evidence and receipts

Receipts are typed, queryable, exportable, and linked to the exact run revision. Minimum receipt classes:

- SourceTruthPreflightReceipt
- OrientationReceipt
- PlanReceipt
- AdvisorReceipt
- EditReceipt
- CommandReceipt
- CheckReceipt
- DiffReceipt
- CheckpointReceipt
- NodeJobReceipt
- ArtifactReceipt
- ReviewReceipt
- UIAcceptanceReceipt
- CompletionReceipt
- RecoveryReceipt

Each receipt includes stable ID, lane ID, turn/run ID, environment ID, timestamps, producer, claim labels, payload schema version, and content hash where applicable.

## Checks dashboard

Checks are grouped by acceptance criterion and severity. Required status vocabulary:

- not-run
- running
- passed
- failed
- skipped-with-reason
- blocked
- stale
- superseded

A check becomes stale when repository HEAD, relevant files, environment configuration, or dependency lock state changes after it ran.

The product must never display "all checks passed" when required checks were skipped, not run, or became stale.

## Diff and ownership experience

The diff view must support:

- lane-only diff;
- staged/unstaged split;
- base-to-head diff;
- commit-by-commit view;
- cross-lane overlap detection;
- generated/vendor filtering;
- test-to-change traceability;
- reviewer annotations;
- checkpoint comparison and restore.

Before merge, show exact files that overlap other active lanes and whether those lanes have uncommitted changes.

## Linux node integration

The Linux node is modeled as an ExecutionEnvironment with dedicated job orchestration.

A node job declares:

- source repository identity and source commit;
- input artifacts;
- exact command and toolchain;
- resource class;
- expected outputs;
- timeout/cancellation policy;
- return path;
- verification required on Mac.

Node output is immutable and content-addressed. Returning an artifact creates a receipt; integrating it into a Mac worktree is a separate explicit event and verification step.

No Python is allowed in node implementation plans or generated worker scripts. Validate this before dispatch.

## Notifications

Notifications are event-driven and actionable. Supported triggers:

- approval or user input required;
- run blocked or failed;
- advisor found a strategy conflict;
- verifier rejected completion;
- tests/build/CI changed state;
- node job completed or failed;
- PR review/check changed;
- deliverable became ready;
- stale lane or environment disconnected;
- recovery required.

A notification opens the exact lane, receipt, check, diff, or action. Avoid generic "agent finished" notifications without evidence state.

## Provider and model management

Provider instances remain separate from provider drivers. Support multiple accounts and endpoints per driver.

Add role presets:

- Executor
- Advisor
- Verifier
- Explorer
- Recovery
- Fast mechanical worker

Role presets select provider instance, model, reasoning, permissions, and context policy. Project-level overrides are allowed and visible.

Model availability is dynamic. Store stable intent (role/capability tier) separately from the concrete current model name so obsolete names do not brick saved workflows.

## Context management

Expose context health per agent:

- provider-reported usage;
- compaction events;
- estimated retained task state;
- durable receipts already externalized;
- risk of context loss.

Compaction must reset/adjust usage honestly. Before context exhaustion, persist a structured handoff containing task contract, source truth, plan revision, edits, checks, blockers, and next action.

## GitHub integration

GitHub is a first-class evidence and delivery surface:

- repository and branch discovery;
- issue/PR linkage;
- PR diff, checks, reviews, and threads;
- branch protection and mergeability;
- comment/review actions;
- artifact and release linkage.

Do not create a PR automatically unless the work contract requests it. When requested, rebase/update from the actual target branch, verify current state, then open a focused PR with evidence.

## Project instructions and reusable skills

Projects can register instruction bundles and reusable workflow skills. The UI must show which instructions were loaded for a lane and their precedence.

Skills are versioned assets with:

- trigger description;
- required connectors/tools;
- input/output contract;
- scripts and references;
- validation status;
- package hash;
- usage history.

A skill cannot silently override repository instructions or safety boundaries.

## Performance requirements

- No continuously repainting progress animations.
- Virtualize large lane, receipt, activity, log, and diff lists.
- Use incremental subscriptions and projection deltas.
- Avoid repeated VCS polling; invalidate from repository events and bounded refresh policies.
- Heavy log parsing and diff summarization run outside the UI thread.
- Mobile defaults to summarized live updates with on-demand detail.
- Persist writes atomically with backup/recovery for critical catalogs and state.

## Reliability requirements

- Event-sourced orchestration remains canonical.
- Commands are idempotent.
- Reactors emit typed receipts.
- Completion decisions are deterministic from state plus receipts.
- Provider replay is deduplicated.
- Background work keeps sessions alive using explicit activity leases, not foreground-turn assumptions.
- Persisted catalogs use atomic replace, fsync where appropriate, validation, and last-known-good recovery.
- A corrupt nonessential projection must be rebuildable from canonical events.

## Security requirements

- Pairing and remote access require explicit authentication.
- Sensitive provider values stay server-side and are never re-sent after storage.
- Every tool permission and full-access selection is visible on the lane.
- Destructive actions require a typed intent and scoped target.
- No pattern-based process killing.
- Never expose live user data to development worktrees.
- Audit all cross-environment artifact transfers.

## Non-goals

- Replacing provider-native reasoning or protocols with one proprietary agent runtime.
- Hiding all complexity behind an opaque "magic" button.
- Automatically merging unreviewed work.
- Treating chat transcript as canonical project state.
- Creating an independent transport protocol for the Linux node.
- Maintaining feature parity with upstream when it conflicts with this fork's evidence and workflow contract.

## Definition of product completion

The fork is fit for daily use only when Nayte can, from desktop and mobile:

1. add both local and remote projects;
2. create an isolated lane with explicit executor/advisor/verifier roles;
3. see preflight source truth before edits;
4. observe and steer all agents and node jobs;
5. inspect structured changes and checks;
6. recover interrupted work without reconstructing context manually;
7. receive actionable attention notifications;
8. open a verified user-visible deliverable;
9. see the exact evidence behind completion;
10. restart the app and retain all of the above.