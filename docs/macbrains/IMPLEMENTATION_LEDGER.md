# MacBrains T3 Code Implementation Ledger

## How to use this ledger

This is the authoritative dependency order for implementation. It is not a phased roadmap that permits partial product claims. Agents may execute independent packages in parallel only when ownership boundaries do not overlap. The fork is not complete until every required package and the end-to-end acceptance matrix pass.

For every package:

1. run source-truth preflight in an isolated worktree;
2. read repository-scoped instructions;
3. inspect current implementation and focused tests;
4. create a plan receipt;
5. request advisor review when required;
6. implement the smallest coherent change;
7. run focused tests, lint, typecheck, build, and UI acceptance as applicable;
8. produce diff, check, review, and completion receipts;
9. update this ledger with evidence links, not prose confidence.

Status vocabulary: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED_UNVERIFIED`, `PROVEN`, `SUPERSEDED`.

## Foundation dependency graph

```text
F0 source truth + lane contracts
  -> F1 receipt/evidence substrate
  -> F2 completion/check invariants
  -> F3 assignment/topology
  -> F4 worktree ownership
  -> F5 command-center projections
  -> F6 client surfaces

F0 -> N0 environment/node contracts -> N1 node job runtime -> N2 artifact return/integration
F3 -> P0 provider normalization -> P1 background leases -> P2 context/recovery
F1 -> R0 persistence hardening -> R1 corruption recovery
F2 -> D0 deliverables -> D1 UI acceptance -> D2 notifications
F4 -> G0 GitHub/change-request integration
All foundations -> E0 end-to-end acceptance
```

---

## F0 — Work lane and source-truth contracts

**Status:** NOT_STARTED

**Objective:** Add the durable `WorkLane`, `TaskContract`, `AcceptanceCriterion`, `SourceTruthRevision`, lifecycle state, commands, events, decider invariants, projector support, persistence schema, and compatibility migration.

**Primary areas:**

- `packages/contracts/src/orchestration.ts` or dedicated explicit subpaths;
- `apps/server/src/orchestration/decider.ts`;
- `apps/server/src/orchestration/commandInvariants.ts`;
- `apps/server/src/orchestration/projector.ts`;
- projection persistence/services;
- `packages/client-runtime` shell/detail models;
- focused orchestration tests.

**Required behavior:**

- lanes persist independently of provider sessions;
- existing threads migrate without false completion;
- lane lifecycle transitions are pure and deterministic;
- source-truth revisions can be recorded and superseded;
- substantial work cannot enter execution without current preflight and worktree evidence;
- command metadata is idempotent;
- web/mobile can decode old and new server payloads during migration.

**Advisor required:** yes — domain and persistence architecture.

**Proof:** contract decode tests, decider transition matrix tests, projection replay tests, migration tests, focused typecheck.

---

## F1 — Typed receipt and evidence substrate

**Status:** NOT_STARTED

**Objective:** Replace transcript-only proof with persisted typed receipts and content-addressed log/artifact references.

**Primary areas:**

- `packages/contracts/src/receipts.ts` (new explicit subpath);
- server receipt store and query service;
- `RuntimeReceiptBus` integration;
- projection and RPC methods;
- artifact storage service;
- web/mobile evidence components.

**Required behavior:**

- receipt envelopes carry lane, assignment, environment, source revision, producer, timestamps, schema version, labels, payload, and hash;
- large logs live as artifacts, not shell projection payloads;
- receipts can supersede earlier receipts without mutation;
- queries filter by lane, kind, source revision, criterion, check, assignment, and time;
- exported evidence has deterministic ordering and hashes;
- every async reactor emits a completion or failure receipt.

**Proof:** hashing tests, serialization/migration tests, artifact immutability tests, query tests, replay tests, web/mobile render tests.

---

## F2 — Checks, acceptance criteria, and completion gate

**Status:** NOT_STARTED

**Objective:** Make completion a deterministic orchestration decision based on current evidence.

**Primary areas:**

- acceptance/check contracts;
- decider completion invariants;
- check staleness service;
- check command reactor;
- completion reactor;
- checks UI and criterion mapping.

**Required behavior:**

- checks have canonical status values;
- required skipped or stale checks prevent completion unless criterion policy explicitly permits them;
- source/dependency changes invalidate relevant checks;
- provider text cannot directly mark a lane complete;
- completion receipt contains the mandated closeout fields;
- invalid evidence can reopen a completed lane as `recovery-required`.

**Proof:** full transition truth table, stale fingerprint tests, false-completion regression tests, completion invalidation tests, UI status tests.

---

## F3 — Agent assignments and topology

**Status:** NOT_STARTED

**Objective:** Model executor, advisor, verifier, explorer, child worker, and recovery roles as visible durable assignments.

**Primary areas:**

- assignment contracts/events/projectors;
- provider session directory integration;
- role preset settings;
- assignment-to-thread binding;
- agent topology projection;
- desktop/web/mobile topology UI.

**Required behavior:**

- each assignment records provider instance, model intent, resolved model, reasoning, tools, environment, and ownership;
- executor/advisor/verifier are distinct roles;
- child agents are visible and attached to explicit parents;
- multiple editors cannot own overlapping paths without an explicit shared-file merge contract;
- recovery assignments supersede but do not erase prior contexts;
- model changes and escalation causes are recorded.

**Proof:** assignment lifecycle tests, ownership conflict tests, provider restart/resume tests, topology rendering tests, multi-device sync tests.

---

## F4 — Worktree and ownership manager

**Status:** NOT_STARTED

**Objective:** Promote worktrees from optional thread metadata to managed lane isolation with overlap protection.

**Primary areas:**

- Git contracts/services;
- worktree creation/bootstrap/removal;
- lane bootstrap command;
- ownership index;
- VCS event invalidation;
- UI creation and status surfaces.

**Required behavior:**

- substantial lanes default to a new worktree;
- base branch/SHA and lane branch are explicit;
- bootstrap scripts run with structured receipts;
- worktree ownership is exclusive;
- path overlap is computed across active lanes;
- destructive removal requires a clean/safe proof or explicit force intent;
- remote environments support project/worktree creation from GUI;
- no pattern-based process killing.

**Proof:** real temporary-repository integration tests, branch-with-slash tests, dirty worktree refusal tests, remote RPC tests, collision tests, restart recovery tests.

---

## F5 — Command Center and projections

**Status:** NOT_STARTED

**Objective:** Replace chat-first landing with an evidence-first command center using compact incremental projections.

**Primary areas:**

- server command-center shell projection;
- client-runtime atoms/services;
- web layout/navigation;
- mobile home/navigation;
- desktop wrapper integration.

**Required behavior:**

- sections for attention, active work, review, ready-to-use, recent evidence, and node activity;
- cards show project/lane/environment/role/model/state/last receipt/next action;
- no full receipt/log payloads in shell data;
- sequence-based incremental updates and cache hydration;
- all cards deep-link to exact evidence/action;
- large lists are virtualized;
- no repainting animations.

**Proof:** projection delta tests, reconnect/cache tests, performance measurement with large seeded data, web/mobile integrated screenshots.

---

## F6 — Lane detail and cross-surface controls

**Status:** NOT_STARTED

**Objective:** Deliver the complete lane workspace on web, desktop, iPhone, and iPad.

**Required tabs/panels:**

- Overview/lifecycle
- Agent topology
- Source truth
- Plan revisions
- Transcript/live activity
- Changes/diff
- Checks
- Receipts/evidence
- Node jobs
- Deliverables
- Recovery/history

**Required controls:**

- start, steer, queue, pause, resume, interrupt;
- request advisor/verifier;
- retry check/node job;
- resolve blocker;
- refresh source truth;
- checkpoint restore;
- open editor/terminal/repository/PR/artifact;
- create remote projects and worktrees.

**Proof:** shared runtime tests, web/mobile parity checklist, real-client acceptance with persisted restart and remote connection.

---

## P0 — Provider event normalization

**Status:** NOT_STARTED

**Objective:** Normalize all supported provider adapters into assignment-aware lifecycle, tool, child-agent, context, and background activity events.

**Providers requiring an explicit implementation decision:**

- Codex
- Claude Code
- Cursor
- Grok Build
- OpenCode

**Required behavior:**

- provider-instance routing remains intact;
- replay/resume events are deduplicated;
- child agents emit visible lifecycle events;
- model/reasoning/options are reported when available;
- unsupported features emit capability records rather than silently disappearing;
- provider errors preserve structured cause and recovery advice;
- adapter complexity does not leak into pure orchestration.

**Proof:** contract tests per adapter, replay/resume regressions, child-agent tests, capability matrix snapshots.

---

## P1 — Background activity leases and session reaper correctness

**Status:** NOT_STARTED

**Objective:** Prevent legitimate background workflows and subagents from being killed after foreground turns settle.

**Primary areas:**

- `ProviderSessionReaper`;
- provider runtime ingestion;
- child-agent/job event handling;
- activity lease store/projection.

**Required behavior:**

- active background work refreshes an explicit lease;
- reaper refuses to stop sessions with valid leases;
- abandoned leases expire deterministically;
- UI shows why a session remains alive;
- lease recovery works after server restart when provider state proves activity;
- no polling-based fake activity.

**Proof:** deterministic clock tests, long-running subagent simulation, restart tests, stale lease cleanup.

---

## P2 — Context health, compaction, and recovery handoff

**Status:** NOT_STARTED

**Objective:** Make context usage honest and recovery automatic before or after provider context failure.

**Required behavior:**

- track provider-reported usage with event epochs;
- compaction reduces/reset usage instead of monotonic `Math.max` ratcheting;
- create structured handoff from canonical lane state;
- recovery agent can resume with source truth, plan, diff, checks, blockers, and exact next action;
- preserve productive explorer context while verifying claims elsewhere;
- context exhaustion cannot erase running node/child work.

**Proof:** compaction regression tests, handoff schema tests, provider switch recovery, context-limit simulation.

---

## N0 — First-class environment and node policy

**Status:** NOT_STARTED

**Objective:** Extend existing execution environments with node capabilities, policies, and project management parity.

**Required behavior:**

- Mac and Linux node are explicit environments;
- environment capability snapshot includes OS, architecture, tools, provider availability, service status, resources, and reachable endpoints;
- remote GUI can add projects and worktrees;
- node policy records no-Python constraint;
- Tailscale remains an endpoint provider, not a new environment type;
- environment setup/version drift is visible.

**Proof:** environment capability tests, remote project creation integration, Tailscale/direct/SSH connection tests, policy validation tests.

---

## N1 — Node job runtime

**Status:** NOT_STARTED

**Objective:** Dispatch bounded heavy work to the Linux node with immutable inputs and typed execution receipts.

**Required behavior:**

- job source commit and input hashes fixed before dispatch;
- validate command/toolchain/language policy;
- queue, cancel, reconnect, and recover jobs;
- stream bounded summaries while preserving complete logs as artifacts;
- collect outputs content-addressably;
- resource telemetry and failure cause visible;
- no claim of integration on completion.

**Proof:** local fake-node tests, real remote environment test, cancellation, disconnect/reconnect, output hash validation, Python rejection tests.

---

## N2 — Artifact return and Mac integration

**Status:** NOT_STARTED

**Objective:** Separate node computation completion from repository integration and Mac verification.

**Required behavior:**

- artifacts have provenance and hash;
- return transfer is resumable and authenticated;
- integrating an artifact creates a distinct event and diff;
- Mac-side checks must rerun where applicable;
- stale source commit blocks blind integration;
- final receipt traces node inputs -> outputs -> integrated files -> Mac verification.

**Proof:** interrupted transfer, hash mismatch, stale source, clean integration, conflict path, end-to-end benchmark bundle.

---

## R0 — Atomic persistence and last-known-good recovery

**Status:** NOT_STARTED

**Objective:** Eliminate single-write corruption paths for critical connection/settings/catalog state.

**Required behavior:**

- temp file in same filesystem;
- write and flush;
- fsync file and parent directory where supported;
- atomic rename;
- schema validation before adoption;
- rotate last-known-good backup;
- never rewrite unchanged content on a fixed cadence;
- expose corruption diagnostics and recovery action.

**Targets:** connection catalog, settings, credentials metadata, environment registrations, any non-SQLite critical JSON state.

**Proof:** fault-injection tests at each write boundary, NUL/truncated/corrupt file recovery, unchanged-write suppression.

---

## R1 — Event/projection and heavy-thread resilience

**Status:** NOT_STARTED

**Objective:** Prevent large threads, logs, and diffs from crashing or bricking a workspace.

**Required behavior:**

- paginate/stream thread detail;
- bounded message and activity rendering;
- large payload artifacts instead of inline state;
- projection rebuild path;
- isolate one corrupt thread rather than failing the environment;
- diagnostic recovery UI without deleting `.t3`;
- memory/CPU budgets measured.

**Proof:** seeded heavy-thread soak, corrupt event/projection simulation, restart recovery, mobile constrained-memory pass.

---

## D0 — Deliverable registry and launch actions

**Status:** NOT_STARTED

**Objective:** Make finished work persistently visible and launchable.

**Deliverable kinds:** application, dashboard, build, installer, PR, patch, report, benchmark, dataset, artifact bundle, URL, service.

**Required behavior:**

- provenance receipts required;
- launch action tested and scoped by surface/environment;
- invalidated or missing outputs cannot remain "ready";
- completed lane links to deliverable;
- deliverables appear in command center and library after restart;
- support local file, remote file, URL, repository/branch/PR, app launch, and service open actions.

**Proof:** kind-specific contract tests, missing-path invalidation, cross-device presentation, restart persistence.

---

## D1 — User-visible UI acceptance

**Status:** NOT_STARTED

**Objective:** Require integrated proof that user-facing changes can be seen and used.

**Required behavior:**

- scenario definitions tied to acceptance criteria;
- web, desktop, and mobile applicability decision;
- screenshot/video artifacts;
- exact build/version/environment;
- launch route and observed result;
- failure blocks completion.

**Proof:** integrated `test-t3-app`, `test-t3-mobile`, desktop smoke/packaged app path as applicable; artifacts attached to receipt.

---

## D2 — Actionable notifications

**Status:** NOT_STARTED

**Objective:** Deliver persistent attention signals with exact actions.

**Required triggers:** approvals/input, blocker/failure, advisor conflict, verifier rejection, check/CI transition, node completion/failure, PR review, deliverable ready, stale lane, environment disconnect, recovery required.

**Required behavior:**

- event-derived, deduplicated, resolveable;
- desktop/mobile push where platform permits;
- clicking opens exact lane/receipt/action;
- user-configurable severity and quiet rules;
- no generic completion notification before completion invariant passes.

**Proof:** notification projection tests, dedupe/resolution, deep-link tests, mobile/desktop integrated pass.

---

## G0 — GitHub evidence and delivery integration

**Status:** NOT_STARTED

**Objective:** Connect lanes to current GitHub repository, issue, PR, checks, reviews, and merge state.

**Required behavior:**

- detect repository identity robustly for HTTPS/SSH/self-hosted remotes;
- link issue/PR to lane;
- show current PR diff/checks/reviews/threads;
- refresh current holder/state rather than trust cached narrative;
- request/create PR only when task contract authorizes it;
- verify target branch and rebase/update before PR;
- keep PR review findings as receipts and blockers;
- support GitHub from remote environments.

**Proof:** public/private repo cases, SSH user variants, stale PR head, review-thread lifecycle, checks update, auth failure.

---

## S0 — Project instruction and skill registry

**Status:** NOT_STARTED

**Objective:** Make reusable workflows discoverable, versioned, visible, and subordinate to repository authority.

**Required behavior:**

- register instruction bundles and skills per project/environment;
- show exactly which were loaded and precedence;
- validate skill structure/hash/version;
- declare required connectors/tools and input/output contract;
- prevent skill from silently overriding repository instructions;
- support export/import and usage history;
- expose a workflow template for ANVIL package execution and source-truth preflight.

**Proof:** precedence tests, incompatible/invalid skill handling, version migration, UI visibility.

---

## U0 — MacBrains branding and fork identity

**Status:** NOT_STARTED

**Objective:** Make the fork unmistakably MacBrains without damaging maintainability.

**Required behavior:**

- product name and official MacBrains logo assets;
- app IDs, package names, data directories, update channels, and signing identifiers do not collide with upstream T3 Code;
- migration/import from upstream profile is explicit and reversible;
- About screen shows upstream commit and fork commit;
- upstream remote/sync documentation exists;
- no accidental calls to upstream hosted services unless intentionally configured.

**Proof:** package metadata inspection, side-by-side install, clean profile, import test, DMG and mobile identity checks.

---

## U1 — Settings and policy editor

**Status:** NOT_STARTED

**Objective:** Expose project, role, model, node, completion, notification, and source-authority policies without burying them.

**Required behavior:**

- global defaults with environment/project/lane overrides;
- effective-policy view explains origin and precedence;
- role presets and fallback model intent;
- no-Python node policy locked for Linux node unless Nayte explicitly changes contract;
- runtime access is per lane/project, not only global binary switch;
- exportable policy JSON with schema version;
- reverse action for every setting mutation.

**Proof:** precedence and migration tests, web/mobile settings parity, secret redaction.

---

## V0 — Performance and telemetry hardening

**Status:** NOT_STARTED

**Objective:** Keep the control plane responsive under many projects, lanes, receipts, VCS refs, and logs.

**Required behavior:**

- no idle VCS request storms;
- event-driven invalidation and bounded refresh;
- slow request diagnostics;
- per-projection payload metrics;
- CPU/memory thresholds in seeded soak tests;
- mobile summarized subscriptions;
- UI thread avoids log parsing/diff computation;
- resource monitor covers server and provider child processes.

**Proof:** clean-profile idle soak, 100-project/1000-lane seeded benchmark, heavy thread, mobile scrolling, reconnect under load.

---

## E0 — End-to-end daily workflow acceptance

**Status:** NOT_STARTED

**Objective:** Prove the entire system as one usable workflow rather than isolated feature demonstrations.

**Canonical scenario:**

1. Open MacBrains T3 Code on the Mac.
2. Pair iPhone/iPad over Tailscale-authenticated endpoint.
3. Add a Mac project and corresponding Linux-node clone from GUI.
4. Create a substantial feature lane from mobile.
5. System creates isolated worktree and records source-truth preflight.
6. Executor begins with medium reasoning.
7. Advisor reviews the oriented plan before broad edits.
8. Executor edits in declared ownership boundary.
9. Heavy build/test job dispatches to Linux node without Python.
10. Node returns content-addressed artifacts.
11. Mac integrates and reruns applicable checks.
12. Verifier independently refreshes source truth and reviews diff/evidence.
13. User-visible app/dashboard change is launched and captured.
14. Completion gate produces final receipt and deliverable.
15. Mobile receives actionable ready-to-use notification.
16. Restart Mac app and Linux service.
17. All lane state, evidence, deliverables, and controls remain available.
18. Simulate provider failure; recovery assignment resumes from canonical handoff.
19. Simulate stale source/check; completion invalidates and returns to recovery.
20. Restore proof and re-complete.

**Proof:** one timestamped acceptance bundle containing video/screenshots, event/receipt export, exact commits, command receipts, checks, environment snapshots, and restart/recovery evidence.

---

## Implementation ownership recommendation

Use non-overlapping lanes:

- Contracts/domain lane: F0, F1 schemas only.
- Server orchestration lane: F0/F1/F2 decider/projector/reactors.
- Worktree/Git lane: F4, G0.
- Provider lane: P0, P1, P2.
- Environment/node lane: N0, N1, N2.
- Persistence/reliability lane: R0, R1.
- Client-runtime lane: shared services/projections.
- Web/desktop lane: F5/F6/D0/D1/D2/U0/U1.
- Mobile lane: F5/F6/D1/D2/U0/U1 mobile-specific.
- Performance/verifier lane: V0 and independent review across all packages.

Shared contract files require a designated single owner and serialized integration. Do not let parallel agents edit `packages/contracts/src/orchestration.ts` simultaneously; split new schemas into explicit subpath files and integrate through one owner.

## Merge order

1. F0 contracts and migration
2. F1 receipts
3. F2 completion/checks
4. F3 assignments
5. F4 worktrees
6. P0/P1/P2 providers
7. N0/N1/N2 environments/node
8. R0/R1 reliability
9. client-runtime projections
10. F5/F6/D0/D1/D2 UI
11. G0/S0/U0/U1 integrations and identity
12. V0 performance
13. E0 acceptance

Every integration branch must rebase on current fork main, run focused tests for its surface, and be independently reviewed before merge.