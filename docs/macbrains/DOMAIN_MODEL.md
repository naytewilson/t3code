# MacBrains Agent Workflow Domain Model

## Scope

This document defines the canonical domain additions required to turn T3 Code into the MacBrains agent operating surface while preserving the existing command -> event -> projection -> reactor -> receipt architecture.

Do not encode these concepts as UI-only state. Anything required for recovery, evidence, multi-device control, or completion must cross typed contracts and persist as events or canonical records.

## Aggregate boundaries

### Project

Existing environment-local workspace aggregate. Extend with policy references, logical project identity, and defaults.

```ts
interface ProjectPolicy {
  sourceTruthPolicyId: string
  workflowTemplateId: string | null
  defaultAgentTopologyId: string | null
  defaultNodePolicyId: string | null
  completionPolicyId: string
  instructionBundleIds: readonly string[]
}
```

The project remains bound to one execution environment and one workspace root. Cross-environment grouping belongs to `RepositoryIdentity` / `LogicalProject`, not to the Project aggregate.

### WorkLane

A durable unit of substantial work. It may contain multiple provider threads over its lifetime, but owns one task contract, source-truth snapshot lineage, worktree, plan revisions, acceptance criteria, and completion decision.

```ts
interface WorkLane {
  id: WorkLaneId
  projectId: ProjectId
  title: string
  taskContract: TaskContract
  state: WorkLaneState
  priority: WorkPriority
  environmentId: EnvironmentId
  repositoryIdentity: RepositoryIdentity | null
  baseRef: GitRef | null
  branch: string | null
  worktreePath: string | null
  ownerAssignmentId: AgentAssignmentId | null
  advisorAssignmentIds: readonly AgentAssignmentId[]
  verifierAssignmentIds: readonly AgentAssignmentId[]
  sourceTruthRevisionId: SourceTruthRevisionId | null
  activePlanRevisionId: PlanRevisionId | null
  acceptanceCriterionIds: readonly AcceptanceCriterionId[]
  requiredReceiptKinds: readonly ReceiptKind[]
  deliverableIds: readonly DeliverableId[]
  blockerIds: readonly BlockerId[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  completedAt: IsoDateTime | null
}
```

### AgentAssignment

A role-specific durable assignment of one provider instance/model configuration to a lane.

```ts
interface AgentAssignment {
  id: AgentAssignmentId
  laneId: WorkLaneId
  role: AgentRole
  providerInstanceId: ProviderInstanceId
  modelIntent: ModelIntent
  resolvedModel: string
  reasoningLevel: ReasoningLevel
  toolPolicyId: string
  environmentId: EnvironmentId
  threadId: ThreadId | null
  parentAssignmentId: AgentAssignmentId | null
  ownership: OwnershipBoundary | null
  status: AgentAssignmentStatus
  contextHealth: ContextHealth
  supersedesAssignmentId: AgentAssignmentId | null
}
```

### NodeJob

A bounded execution unit dispatched to a remote environment, especially the Linux node.

```ts
interface NodeJob {
  id: NodeJobId
  laneId: WorkLaneId
  environmentId: EnvironmentId
  sourceRepository: RepositoryIdentity
  sourceCommit: string
  commandSpec: CommandSpec
  inputArtifacts: readonly ArtifactReference[]
  expectedOutputs: readonly ExpectedArtifact[]
  resourceClass: NodeResourceClass
  languagePolicy: NodeLanguagePolicy
  status: NodeJobStatus
  outputArtifactIds: readonly ArtifactId[]
  dispatchedAt: IsoDateTime | null
  completedAt: IsoDateTime | null
}
```

### Deliverable

A user-visible output. A lane cannot complete without at least one deliverable unless the task contract explicitly declares `deliverableRequirement: none` and the verifier accepts that declaration.

```ts
interface Deliverable {
  id: DeliverableId
  laneId: WorkLaneId
  kind: DeliverableKind
  title: string
  location: DeliverableLocation
  launchAction: LaunchAction | null
  provenanceReceiptIds: readonly ReceiptId[]
  acceptanceReceiptId: ReceiptId | null
  visibleOnSurfaces: readonly ClientSurface[]
  status: DeliverableStatus
}
```

## Value objects

### TaskContract

```ts
interface TaskContract {
  objective: string
  constraints: readonly Constraint[]
  nonGoals: readonly string[]
  deliverableRequirement: "required" | "none"
  requiresPullRequest: boolean
  requiresUserVisibleSurface: boolean
  authorizedActions: readonly AuthorizedAction[]
  prohibitedActions: readonly ProhibitedAction[]
  completionReportRequired: true
}
```

### AcceptanceCriterion

```ts
interface AcceptanceCriterion {
  id: AcceptanceCriterionId
  laneId: WorkLaneId
  description: string
  category: "foundation" | "correctness" | "reproducibility" | "test" | "delivery" | "performance" | "security"
  required: boolean
  evidenceRule: EvidenceRule
  status: CriterionStatus
  supportingReceiptIds: readonly ReceiptId[]
}
```

### ModelIntent

Concrete model names are unstable. Persist intent separately.

```ts
interface ModelIntent {
  capabilityTier: "mechanical" | "standard" | "advanced" | "frontier"
  latencyPreference: "fast" | "balanced" | "quality"
  costPreference: "free-flat-local-first" | "balanced" | "quality-first"
  continuityRequired: boolean
  independentVerificationRequired: boolean
}
```

### OwnershipBoundary

```ts
interface OwnershipBoundary {
  includePaths: readonly string[]
  excludePaths: readonly string[]
  symbols: readonly string[]
  sharedFiles: readonly SharedFileRule[]
  mergeContract: string
}
```

### ClaimLabel

All machine-generated conclusions use:

```ts
type ClaimLabel = "PROVEN" | "INFERRED" | "SUSPECTED" | "UNKNOWN"
```

No additional synonym such as `confirmed`, `likely`, or `validated` may replace the canonical label in persisted evidence.

## State machines

### WorkLaneState

```ts
type WorkLaneState =
  | "queued"
  | "preflight"
  | "oriented"
  | "planned"
  | "executing"
  | "testing"
  | "reviewing"
  | "deliverable-ready"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled"
  | "superseded"
  | "recovery-required"
```

Allowed normal transitions:

- `queued -> preflight`
- `preflight -> oriented | blocked | cancelled`
- `oriented -> planned | blocked | cancelled`
- `planned -> executing | blocked | cancelled`
- `executing -> testing | blocked | failed | recovery-required | cancelled`
- `testing -> executing | reviewing | blocked | failed | recovery-required`
- `reviewing -> executing | testing | deliverable-ready | blocked | failed | recovery-required`
- `deliverable-ready -> completed | executing | testing | reviewing | blocked`

`completed` is terminal except for an explicit `completion.invalidated` event, which moves the lane to `recovery-required` when evidence becomes stale or false.

### AgentAssignmentStatus

```ts
type AgentAssignmentStatus =
  | "pending"
  | "starting"
  | "active"
  | "waiting"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "superseded"
```

### NodeJobStatus

```ts
type NodeJobStatus =
  | "draft"
  | "validating"
  | "queued"
  | "dispatching"
  | "running"
  | "collecting"
  | "completed"
  | "failed"
  | "cancelled"
  | "stale"
```

## Commands

Add commands to `packages/contracts` and enforce invariants in the pure decider.

### Lane commands

- `lane.create`
- `lane.task-contract.update`
- `lane.preflight.request`
- `lane.orientation.record`
- `lane.plan.propose`
- `lane.plan.activate`
- `lane.execution.start`
- `lane.testing.start`
- `lane.review.request`
- `lane.deliverable.register`
- `lane.completion.request`
- `lane.block`
- `lane.unblock`
- `lane.cancel`
- `lane.supersede`
- `lane.recovery.request`
- `lane.completion.invalidate`

### Assignment commands

- `agent-assignment.create`
- `agent-assignment.start`
- `agent-assignment.steer`
- `agent-assignment.queue-input`
- `agent-assignment.pause`
- `agent-assignment.resume`
- `agent-assignment.interrupt`
- `agent-assignment.complete`
- `agent-assignment.fail`
- `agent-assignment.supersede`

### Source-truth commands

- `source-truth.preflight.record`
- `source-truth.conflict.record`
- `source-truth.authority.pin`
- `source-truth.refresh.request`

### Evidence commands

- `receipt.record`
- `receipt.supersede`
- `check.define`
- `check.start`
- `check.finish`
- `check.mark-stale`
- `claim.record`

### Node commands

- `node-job.create`
- `node-job.validate`
- `node-job.dispatch`
- `node-job.cancel`
- `node-job.artifact.record`
- `node-job.complete`
- `node-job.fail`
- `node-job.integrate.request`
- `node-job.integrate.record`

### Deliverable commands

- `deliverable.register`
- `deliverable.launch-action.set`
- `deliverable.acceptance.request`
- `deliverable.acceptance.record`
- `deliverable.invalidate`

## Events

Every accepted command emits immutable domain events. Use past tense and preserve intent/result separation.

Examples:

- `lane.created`
- `lane.preflight-requested`
- `source-truth.preflight-recorded`
- `lane.oriented`
- `lane.plan-proposed`
- `lane.plan-activated`
- `agent-assignment-created`
- `agent-assignment-started`
- `agent-assignment-steered`
- `check-started`
- `check-finished`
- `check-became-stale`
- `node-job-dispatched`
- `node-job-artifact-recorded`
- `review-recorded`
- `deliverable-registered`
- `ui-acceptance-recorded`
- `completion-requested`
- `completion-rejected`
- `lane-completed`
- `lane-recovery-required`

## Receipt envelope

```ts
interface ReceiptEnvelope<Kind extends ReceiptKind, Payload> {
  id: ReceiptId
  kind: Kind
  schemaVersion: number
  laneId: WorkLaneId
  turnId: TurnId | null
  assignmentId: AgentAssignmentId | null
  environmentId: EnvironmentId
  producedBy: ReceiptProducer
  producedAt: IsoDateTime
  sourceRevision: SourceRevision
  claimLabels: readonly ClaimLabel[]
  payload: Payload
  contentHash: string
  supersedesReceiptId: ReceiptId | null
}
```

### SourceRevision

```ts
interface SourceRevision {
  repositoryIdentity: RepositoryIdentity | null
  workspaceRoot: string | null
  branch: string | null
  headSha: string | null
  worktreePath: string | null
  dirtyFingerprint: string | null
  dependencyFingerprint: string | null
}
```

A receipt is stale when the source revision no longer matches the evidence rule governing it.

## Required receipt payloads

### SourceTruthPreflightReceipt

- requested path
- repository root
- Git common dir
- branch/detached state
- HEAD
- status porcelain
- staged/unstaged/untracked summaries
- worktree list
- operation state
- remotes with credentials redacted
- instruction files in precedence order
- manifests and build/test candidates
- relevant files and tests
- generated/vendor boundaries
- ownership collision assessment
- unknowns that change action
- safe next action

### PlanReceipt

- objective
- plan revision
- files/symbols expected to change
- ownership boundary
- checks mapped to acceptance criteria
- advisor requirement and status
- rollback/recovery strategy
- risks and evidence gaps

### CommandReceipt

- exact command argv or structured invocation
- environment and cwd
- redacted environment variables
- start/end timestamps
- exit status/signal
- stdout/stderr artifact references
- source revision before and after

### CheckReceipt

- check definition ID
- category and required flag
- command receipt IDs
- status
- assertion summary
- relevant file fingerprint
- logs/artifacts
- skip/block reason

### ReviewReceipt

- reviewer assignment
- source truth independently refreshed
- diff reviewed
- checks reviewed
- acceptance criteria verdicts
- findings with severity
- rejected claims
- final verdict

### UIAcceptanceReceipt

- client surface
- build/version
- scenario steps
- visible result
- screenshot/video artifact IDs
- launch/access action tested
- result status

### CompletionReceipt

- final commit/branch/PR
- final diff summary
- required receipt checklist
- deliverable IDs
- claim ledger
- missing evidence
- possibly wrong or overstated
- exact next action
- what does not count as completion
- safe continuation context

## Completion invariant

`lane.completion.request` is accepted only when:

1. lane state is `deliverable-ready`;
2. active source-truth revision matches final diff/check receipts;
3. all required acceptance criteria are passed;
4. no required check is `not-run`, `failed`, `blocked`, `stale`, or `skipped-with-reason` unless the criterion explicitly permits it;
5. verifier receipt exists and does not reject completion;
6. required deliverables exist;
7. user-visible surface tasks have a passing UI acceptance receipt;
8. no unresolved blocker exists;
9. completion report fields are populated.

The decider, not the provider adapter or UI, enforces this invariant.

## Advisor invariant

An advisor receipt is required before broad or irreversible execution when any applies:

- architecture or domain model change;
- persistence migration;
- concurrency or lifecycle change;
- security boundary change;
- performance-sensitive hot path;
- destructive repository operation;
- source authorities conflict;
- plan changes after failed implementation;
- task risk is marked high.

The advisor may approve, approve with constraints, or reject. Rejection blocks execution until a revised plan is activated.

## Worktree invariant

A lane marked `substantial` cannot enter `executing` unless:

- a worktree path is recorded;
- the worktree points to the expected branch and base lineage;
- source-truth preflight covers that path;
- no other active lane owns that same worktree;
- overlap analysis is current.

A task explicitly classified as `bounded-readonly` or `tiny-reversible` may use the primary checkout if the preflight proves it is safe.

## Node language invariant

A Linux-node job is rejected before dispatch when its command, generated script, task prompt, or declared implementation language requires Python. This policy applies to implementation and worker automation; existing project test tooling that invokes Python must be surfaced as a blocker or explicitly waived by project policy, never silently used.

## Provider integration

Provider adapters remain responsible for protocol translation only. They emit normalized runtime events including:

- session lifecycle;
- turn lifecycle;
- text/message deltas;
- tool call lifecycle;
- approval/user-input requests;
- token/context telemetry;
- child-agent lifecycle;
- background activity lease;
- provider-native errors.

The lane orchestrator maps these events to assignments, receipts, and lane lifecycle. Do not put completion policy inside individual adapters.

## Background activity lease

Add a provider-neutral activity lease:

```ts
interface BackgroundActivityLease {
  assignmentId: AgentAssignmentId
  source: "provider" | "child-agent" | "node-job" | "reactor"
  lastActivityAt: IsoDateTime
  expiresAt: IsoDateTime
  description: string
}
```

The session reaper must not stop a session while a valid lease exists. Leases are refreshed by real provider/child/job activity, not polling the foreground turn state.

## Projection strategy

Create separate projections optimized for:

- command center shell;
- lane detail;
- source-truth panel;
- agent topology;
- checks dashboard;
- deliverables library;
- environment/node jobs;
- notifications;
- audit/evidence export.

Use incremental sequence-based subscriptions. Do not append full logs or full receipt payloads to the shell projection.

## Persistence and recovery

- Canonical domain events remain append-only.
- Projection state is rebuildable.
- Critical JSON catalogs use atomic temp-write + fsync + rename + last-known-good backup.
- Receipt artifacts are content-addressed and immutable.
- Provider replay events are deduplicated by stable provider item identity and session/resume epoch.
- Corrupt optional caches degrade gracefully and surface a recovery action.
- Recovery agents receive a generated handoff derived from canonical state, not the previous agent's prose summary alone.

## Notification derivation

Notifications are projections from events and attention rules. They are not directly emitted ad hoc by providers.

Each notification includes:

- severity;
- lane/project/environment;
- source event and receipt;
- exact action route;
- deduplication key;
- resolved state.

## Migration

Introduce schema versions and compatibility transforms for existing projects and threads.

Migration defaults:

- existing threads without lanes become one imported lane per thread;
- imported lanes receive `taskContract.objective` from the first user message or thread title and are marked `UNKNOWN` quality;
- existing worktree metadata is preserved;
- existing checkpoints remain attached to the imported lane;
- existing provider sessions become executor assignments;
- no historical thread is falsely marked completed under the new invariant;
- imported lanes default to `recovery-required` or `queued` depending on current session state.

## Naming

Use `lane` for the durable work package, `thread` for provider conversation history, `assignment` for a role-bound agent instance, `job` for bounded remote execution, `receipt` for durable evidence, and `deliverable` for a user-visible output. Do not overload these terms.