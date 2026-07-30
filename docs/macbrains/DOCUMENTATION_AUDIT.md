# MacBrains T3 Code Documentation Audit

## Purpose

This audit records documentation, architecture, operational constraints, and contradictions discovered while preparing the MacBrains fork contract. It is a navigation aid and risk register, not a substitute for inspecting current source.

Agents must re-check every referenced file and current implementation before editing because this upstream project changes rapidly and several documents are already stale relative to source.

## Documentation areas inspected

### Repository governance and contribution

- `README.md`
- `AGENTS.md`
- `CONTRIBUTING.md`
- root `package.json`
- `t3.json`

### Architecture

- `docs/architecture/overview.md`
- `docs/architecture/providers.md`
- `docs/architecture/connection-runtime.md`
- `docs/architecture/remote-environments.md`
- `docs/architecture/server-updates.md`
- `docs/reference/encyclopedia.md`
- `docs/reference/workspace-layout.md`
- `docs/reference/scripts.md`
- `docs/git-integration-plan.md`

### User and environment operation

- `docs/getting-started/quick-start.md`
- `docs/user/remote-access.md`
- `docs/user/background-service.md`
- `docs/user/runtime-modes.md`
- `docs/providers/codex.md`
- `docs/providers/claude.md`
- `docs/cloud/environment-auth.md`
- `docs/integrations/source-control-providers.md`

### Development, observability, CI, and release

- `docs/operations/ci.md`
- `docs/operations/observability.md`
- `docs/operations/release.md`
- root package scripts
- repository issue tracker for current limitations and regressions

## Confirmed architectural strengths

### Typed event-sourced orchestration

The current server already has the correct foundation for durable MacBrains workflow state:

- typed commands and wire contracts;
- pure decision logic;
- persisted domain events;
- projections/read models;
- queue-backed side-effect reactors;
- typed runtime receipts;
- Git checkpoints and turn diffs.

The MacBrains work should add lane, assignment, evidence, checks, deliverables, and recovery concepts inside this architecture. It should not create a second orchestration database or use transcript text as canonical workflow state.

### Provider driver and instance separation

Current source supports provider drivers, multiple configured instances, per-instance routing, continuation identity, and session recovery. This is a strong base for executor/advisor/verifier role presets and multiple accounts or routing configurations.

### Environment and connection separation

The remote design correctly distinguishes:

- execution environment;
- saved known environment;
- access endpoint;
- launch method;
- endpoint provider such as Tailscale.

Keep this model. The Linux node should be another execution environment with node-job capabilities, not a special transport bolted into the renderer.

### Shared client connection runtime

Web and mobile already share a durable connection runtime with environment-scoped services, reconnect policy, cached state, and sequence-based subscriptions. MacBrains projections should extend that runtime rather than create client-owned sockets or retry loops.

### Worktree and checkpoint primitives

Branch/worktree fields, worktree bootstrap, project setup scripts, Git services, and hidden checkpoint refs already exist. The work is to make isolation and ownership mandatory/visible for substantial lanes, not to recreate Git worktree support.

## Documentation contradictions and stale statements

### Provider implementation contradiction

`docs/architecture/providers.md` states that Codex is the only implemented provider and Claude is only reserved in contracts/UI. That conflicts with:

- the root README listing Codex, Claude, Cursor, Grok Build, and OpenCode;
- current provider driver/instance source;
- provider-specific documentation;
- recent provider behavior issues.

**Rule:** treat current source and tested provider capability snapshots as authority. Update or retire the stale architecture page as part of P0.

### Development command contradiction

`docs/getting-started/quick-start.md` uses `bun run ...`, while root scripts and current repository instructions center on Vite+ `vp`, Node scripts, and worktree-aware dev runner behavior.

**Rule:** agents must derive commands from current root/package manifests and `AGENTS.md`. Do not copy quick-start commands into receipts until proven on the selected revision.

### Queueing contradiction

`docs/project/todo.md` still lists queueing messages as a larger TODO. The issue tracker also requests Steer/Queue behavior, while current interaction/runtime contracts and provider behavior have evolved.

**Rule:** inspect current source before assuming queueing is absent or complete. MacBrains requires explicit durable `steer` and `queue-input` commands regardless of provider-specific partial behavior.

### Contribution policy mismatch

Upstream contribution guidance rejects broad opinionated changes and 1,000+ line feature PRs. This is appropriate for upstream but not the product scope of a private fork campaign.

**Rule:** preserve small focused branches and reviews for maintainability, but do not limit the fork to upstream's contribution appetite. Never open the MacBrains overhaul as one giant upstream PR.

## Product limitations confirmed by documentation

### Remote project management gap

The remote access guide explicitly says the GUIs cannot add projects on remote environments and recommends server-side CLI as a workaround.

This is a foundation blocker for the Linux node and mobile-first control. F4/F6/N0 must add authenticated remote project and worktree operations through existing environment RPC boundaries.

### Runtime policy presentation is too coarse

The user runtime guide presents a global full-access versus supervised switch. Current contracts contain more provider modes, but the user model is still too broad for project/lane/role-specific policy.

MacBrains requires effective policy resolution at:

1. global default;
2. environment;
3. project;
4. lane;
5. role preset;
6. assignment override.

The UI must show the effective result and its origin.

### No complete evidence-gated completion model

Existing quiescence, turn completion, checkpoints, and settlement are useful but do not prove:

- current source truth;
- tests/checks against current HEAD;
- independent review;
- node artifact integration;
- user-visible delivery;
- durable launch path.

F1/F2/D0/D1 must make completion a decider invariant rather than a provider/UI convention.

## Reliability limitations from current issue evidence

### Background session reaping

Issue `#4198` describes active background workflows/subagents being terminated because the session reaper only recognizes an active foreground turn.

Required correction: explicit provider-neutral background activity leases, deterministic expiry, and visible session-retention reason.

### Context compaction accounting

Issue `#4650` describes context usage remaining monotonic after compaction.

Required correction: usage epochs and provider-compaction events; never merge all usage values with an unconditional maximum.

### Heavy thread failure and destructive workaround

Issue `#996` reports heavy-thread crashes and recovery by deleting `.t3`.

Required correction: bounded projections/rendering, artifact-backed large payloads, corrupt-thread isolation, projection rebuild, and in-app recovery. Deleting user state is prohibited as normal recovery.

### Non-atomic connection catalog persistence

Issue `#4750` reports repeated in-place catalog writes and unrecoverable corruption after interruption.

Required correction: atomic same-filesystem write/flush/rename, last-known-good backup, schema validation, unchanged-write suppression, and repair UI.

### Idle VCS request storm

Issue `#4773` reports idle `vcs.listRefs` request storms causing CPU saturation, timeouts, and false reconnect behavior.

Required correction: event-driven invalidation, deduplicated/bounded refresh, per-repository request ownership, and idle soak acceptance.

### Provider replay duplication

Issue `#3149` reports Cursor ACP resume replaying prior updates into an existing thread.

Required correction: provider event epoch/item identity and deduplication before orchestration append.

### Git remote parsing and private clone edges

Issues `#3648` and `#3664` show gaps in SCP-style remote parsing and private GitHub project onboarding.

Required correction: robust remote parser, authenticated clone path, explicit credential diagnostics, and private-repository integration tests.

## Observability implications

Current observability documentation says:

- stdout logs are human-facing and not persisted;
- completed spans are persisted to local NDJSON;
- metrics are in-process or remote OTLP only;
- provider event NDJSON is separate.

MacBrains receipts must not pretend stdout is durable evidence. Required command/check logs need explicit artifact capture and hashes. Traces remain diagnostic telemetry, not substitutes for completion receipts.

The UI should correlate lane/assignment/check/node-job IDs into spans while keeping metric labels low-cardinality.

## Authentication and remote security implications

Current environment authentication is capability-based and uses:

- one-time bootstrap credentials;
- browser session cookies;
- bearer token exchange;
- short-lived WebSocket tickets;
- per-RPC scopes.

MacBrains should extend scopes deliberately for new operations if required, rather than treating pairing as blanket authority. Remote project creation, worktree mutation, node-job dispatch, artifact transfer, evidence export, and administrative recovery need explicit authorization decisions.

The existing hard-cutover auth migration deleted old sessions and required re-pairing. Future migration work must expose planned re-pairing/recovery behavior and must never silently strand mobile devices.

## Server update implications

The current update architecture:

- targets the client's exact server version;
- supports boot-service, foreground respawn, desktop-managed, and manual paths;
- verifies the replacement before handoff;
- has no separate progress stream;
- depends on exact package publication before client release.

MacBrains fork identity changes must supply a separate server package/update source or disable upstream self-update paths until configured. The lane UI should model update work as structured progress/receipts rather than an indefinitely pending button.

## Release and hosted-service collision risks

The upstream release process assumes:

- npm package `t3`;
- app/bundle identity associated with T3 Code;
- GitHub release updater metadata;
- upstream relay deployment and production credentials;
- Clerk configuration;
- Vercel domains under `app.t3.codes`;
- T3 Connect production resources;
- Apple app ID `com.t3tools.t3code`.

A fork that changes only visible branding could still:

- overwrite or share upstream user data;
- check upstream releases;
- publish to an unavailable npm name;
- connect to upstream hosted services;
- use incompatible passkey/associated-domain configuration;
- collide with the upstream desktop install.

U0 must split package names, bundle IDs, data directories, updater repository/channels, hosted domains, relay/Clerk configuration, and release credentials before distributing a branded build.

## Source-control integration scope

Source-control documentation covers GitHub, GitLab, Bitbucket, and Azure DevOps. MacBrains workflow should keep the generic source-control provider boundary, while GitHub receives the deepest initial lane/PR/check/review integration because the user's active repositories are there.

Do not hard-code GitHub assumptions into work-lane domain contracts. Store generic change-request identity and provider-specific payloads at the adapter boundary.

## CI and verification implications

Current CI runs broad quality gates and release builds multiple desktop platforms. Repository instructions require focused checks during ordinary changes and discourage repeatedly running the entire monorepo suite locally.

MacBrains policy:

- focused checks per package during implementation;
- broader integration checks when shared contracts/projections change;
- full CI/release gate before declaring the fork ready;
- every result tied to exact HEAD and invalidated by relevant changes;
- UI acceptance on all applicable surfaces, not inferred from TypeScript success.

## Documents requiring eventual upstream/fork repair

The implementation campaign should update these as behavior lands:

- `README.md` — MacBrains fork identity and current supported workflow.
- `docs/architecture/providers.md` — current provider architecture and capability matrix.
- `docs/getting-started/quick-start.md` — authoritative toolchain commands.
- `docs/project/todo.md` — remove stale queueing status or replace with current ledger.
- `docs/user/remote-access.md` — remove remote-project CLI workaround after F4/F6/N0.
- `docs/user/runtime-modes.md` — effective project/lane/role policy.
- `docs/reference/encyclopedia.md` — lane, assignment, receipt, check, blocker, deliverable, node job.
- `docs/architecture/overview.md` — lane/evidence orchestration.
- `docs/architecture/server-updates.md` — fork package/update identity and progress receipts.
- `docs/operations/observability.md` — correlation with lane/check/node receipt IDs.
- `docs/operations/release.md` — MacBrains release channels and no upstream collisions.
- provider guides — capability and role preset behavior.

Documentation updates must ship with the corresponding implementation package, not as promises detached from behavior.

## Final audit verdict

**PROVEN:** The repository has the architectural primitives needed for the MacBrains control plane without a ground-up rewrite.

**PROVEN:** Several documented limitations and current regressions directly block the requested workflow and are represented as foundation/correctness packages in the implementation ledger.

**INFERRED:** Isolating fork-specific modules and adding durable lane/evidence projections will preserve upstream sync better than rewriting thread/provider/environment foundations.

**UNKNOWN until implementation preflight:** exact current file ownership, migration numbers, adapter capability details, UI component boundaries, active upstream fixes, and command/test behavior on the agent's selected revision.