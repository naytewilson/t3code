# MacBrains T3 Code Fork Baseline

## Baseline identity

- Fork: `naytewilson/t3code`
- Upstream: `pingdotgg/t3code`
- Fork default branch at analysis time: `main`
- Baseline commit: `b125b7635170ec0c33f8ddf39299155a21f8c9b9`
- Fork and upstream were identical at that commit.
- Specification branch: `macbrains/agent-workflow-overhaul`

Agents must re-verify all of this before implementation. This document records the initial analysis, not perpetual truth.

## Existing architecture worth preserving

### Event-sourced orchestration

The server already uses typed WebSocket requests, a pure decider, persisted domain events, projectors, queue-backed reactors, and typed runtime receipts. Each turn ends with Git checkpointing. This is the correct foundation for durable work lanes and evidence-driven completion.

Relevant sources:

- `AGENTS.md`
- `docs/architecture/overview.md`
- `docs/reference/encyclopedia.md`
- `packages/contracts/src/orchestration.ts`
- `apps/server/src/orchestration/`
- `apps/server/src/checkpointing/`

### Multi-surface connection runtime

Web and mobile share an environment-scoped connection runtime with persistent catalogs, retry ownership, cache hydration, and sequence-based subscriptions. Desktop wraps the web app and manages a local backend. Remote environments remain one T3 server reached through access endpoints.

Relevant sources:

- `docs/architecture/connection-runtime.md`
- `docs/architecture/remote-environments.md`
- `packages/client-runtime/`
- `apps/web/`
- `apps/mobile/`
- `apps/desktop/`

### Provider instance architecture

Providers are no longer hard-coded singletons. The repository has provider drivers, multiple instances, continuation identity, adapter registry, session directory, and instance-aware routing. This is compatible with role-specific executor/advisor/verifier presets and multiple accounts.

Relevant sources:

- `apps/server/src/provider/ProviderDriver.ts`
- `apps/server/src/provider/Services/ProviderAdapterRegistry.ts`
- `apps/server/src/provider/Layers/ProviderService.ts`
- `docs/providers/codex.md`

### Worktree and checkpoint primitives

Threads already record branch/worktree metadata, turn bootstrap can prepare a worktree, project scripts can run on worktree creation, and checkpoints use hidden Git refs. These primitives should be promoted into managed lane isolation rather than replaced.

Relevant sources:

- `packages/contracts/src/orchestration.ts`
- `docs/git-integration-plan.md`
- `t3.json`
- `apps/server/src/git/`
- `apps/server/src/checkpointing/`

### Remote/Tailscale/SSH primitives

The remote architecture treats Tailscale as an endpoint provider and keeps launch methods separate from WebSocket access. Desktop-managed SSH launch, direct endpoints, pairing, and Linux systemd service support already exist.

Relevant sources:

- `docs/architecture/remote-environments.md`
- `docs/user/remote-access.md`
- `docs/user/background-service.md`

## Current limitations that directly conflict with the MacBrains contract

### Chat/thread is the dominant durable unit

The current model persists projects, threads, turns, activities, sessions, plans, and checkpoints, but not a higher-level durable work lane with task contract, role topology, source-truth lineage, acceptance criteria, checks, deliverables, and deterministic completion.

Required response: F0-F3 in the implementation ledger.

### Runtime policy is too coarse

Current runtime modes are provider/session access modes. User-facing documentation primarily presents a global full-access versus supervised choice. The MacBrains workflow needs effective policies at global, environment, project, lane, role, and assignment levels.

Required response: U1 plus lane policy contracts.

### Remote GUI project creation is documented as unsupported

The remote-access guide states that GUIs cannot currently add projects on remote environments and recommends server-side CLI as a workaround. This blocks first-class Linux-node and mobile workflows.

Required response: F4, F6, N0.

### Completion is not evidence-gated

Current turn quiescence and checkpoints are useful runtime milestones, but there is no complete acceptance-criterion/check/deliverable gate preventing an assistant message or settled foreground turn from appearing finished while tests, background workers, or user-visible delivery are incomplete.

Required response: F1, F2, D0, D1.

### Background session reaping can conflict with subagent work

Upstream issue `#4198` reports the idle session reaper can terminate sessions while dynamic workflows or subagents continue after the foreground turn settles. The current busy guard relies on foreground projection state rather than an explicit background activity lease.

Required response: P1.

### Context telemetry can become dishonest after compaction

Upstream issue `#4650` reports context usage ratcheting upward and not reflecting `/compact`, caused by cumulative progress values merged with monotonic maximum behavior.

Required response: P2.

### Heavy threads can make a workspace unusable

Upstream issue `#996` reports crashes and a workspace that only recovers after deleting `.t3`. The fork must isolate corrupt/heavy state and provide in-app recovery without data deletion.

Required response: R1.

### Critical catalog writes may be corruption-prone

Upstream issue `#4750` reports non-atomic repeated writes to `connection-catalog.json`, where an interrupted write can permanently brick the app state without fallback.

Required response: R0.

### Idle VCS refresh can become CPU-bound

Upstream issue `#4773` reports repeated `vcs.listRefs` activity that can make the local backend unresponsive and trigger reconnect behavior while idle.

Required response: V0.

### Active-run interaction modes are incomplete

Upstream issue `#231` requests explicit steer and queue modes alongside default/plan. MacBrains requires start, steer, queue, pause, resume, interrupt, and recovery as durable actions.

Required response: F3, F6, P0.

### Named custom-agent selection is incomplete

Upstream issue `#3875` describes child-agent tracking but no deterministic selection boundary for named Codex custom agents. MacBrains requires visible role/assignment selection before child creation.

Required response: F3, P0.

### Private repository and remote parsing edges exist

Upstream issue `#3664` reports private GitHub repository add/clone failure. Issue `#3648` reports SCP-like SSH remotes with users other than `git@` not being detected.

Required response: G0.

### Lifecycle hooks/notifications are not a stable public integration surface

Upstream issue `#376` requests a clean lifecycle hook boundary for external notification tools. MacBrains requires event-derived actionable notifications and can expose a stable hook/export boundary after canonical notification events exist.

Required response: D2.

## Build and toolchain baseline

The root manifest currently declares:

- Node engine `^24.13.1`;
- pnpm package manager metadata;
- Vite+ (`vp`) tasks;
- TypeScript/Effect application stack;
- Rust resource monitor;
- Electron desktop, React/Vite web, React Native mobile;
- build, focused test, lint, format, typecheck, desktop smoke, and packaging scripts.

Repository instructions prohibit casual repo-wide checks during ordinary focused changes and require targeted proof, while final integration/release work will necessarily need an explicitly authorized broader gate.

Agents must use commands proven by current manifests/instructions and must not assume stale quick-start examples are authoritative when they conflict with root package scripts or `AGENTS.md`.

## Development-state safety baseline

Existing repository instructions already require:

- never kill by process-name/path pattern;
- never start development work against live `~/.t3/userdata`;
- never bake localhost origins into the web bundle;
- use isolated worktree `.t3` state;
- wait on receipts and worker drains rather than sleeps;
- consider web, desktop, mobile, providers, contracts, connection modes, reverse states, and documentation for every feature.

These remain mandatory and are extended, not weakened, by `MACBRAINS.md`.

## Initial implementation conclusion

The fork does not need a ground-up rewrite. It needs a new durable work-lane/evidence layer integrated with existing event sourcing, provider instances, worktrees, checkpoints, connection runtime, and remote environment model. The largest architectural risks are schema migration, projection size/performance, provider lifecycle normalization, background leases, and cross-surface feature completeness.

No implementation claim should rely on this baseline alone. Re-run source-truth preflight against the selected worktree and current branch before every package.