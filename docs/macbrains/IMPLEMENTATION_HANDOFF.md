# MacBrains T3 Code Implementation Handoff

## Current source-truth receipt

This handoff was created from GitHub-visible repository state. A local clone was not available in the working container because outbound DNS resolution failed. Therefore no local build, dependency installation, test, lint, or rendered-client validation was performed.

### Proven repository identity at specification start

- Fork: `naytewilson/t3code`
- Upstream: `pingdotgg/t3code`
- Baseline fork/upstream commit: `b125b7635170ec0c33f8ddf39299155a21f8c9b9`
- Baseline comparison: identical
- Specification branch: `macbrains/agent-workflow-overhaul`

Re-verify current HEAD and divergence before implementation; this branch has advanced through documentation commits after the baseline.

## Durable specification artifacts

- `MACBRAINS.md`
- `AGENTS.md` MacBrains fork directive
- `docs/macbrains/README.md`
- `docs/macbrains/FORK_BASELINE.md`
- `docs/macbrains/DOCUMENTATION_AUDIT.md`
- `docs/macbrains/PRODUCT_SPEC.md`
- `docs/macbrains/DOMAIN_MODEL.md`
- `docs/macbrains/IMPLEMENTATION_LEDGER.md`
- `docs/macbrains/ACCEPTANCE_MATRIX.md`
- `docs/macbrains/DEFAULT_POLICIES.json`
- `docs/macbrains/FORK_IDENTITY_AND_RELEASE.md`
- `docs/macbrains/PULL_TO_MAC.md`
- `docs/macbrains/AGENT_EXECUTION_PROMPT.md`

## Specification branch commit sequence

The branch was built as a sequence of GitHub commits. Agents must use the branch's current HEAD, not assume an intermediate SHA is complete.

Known commits in creation order:

- `9f2652a34bbe66faf64bf1db1f9644f44c6cf902` — operating contract
- `dd6e8dbc7eb41004f959e93092f5b0e5ba9f2fb3` — product specification
- `213f22ac6d6b1d9b054e57cf6123446c286307d0` — domain model
- `a1f431fb0a43a6e1b1a4fc58c19ff2393206aba4` — implementation ledger
- `e0131360ae8e29380a650438d3d057b151628bf5` — acceptance matrix
- `465bfe17cb999a5535c2d9732c91adcb30471f9c` — agent execution prompt
- `74ef33122aca001eb938ba4f431cc900752942dc` — fork baseline
- `4862fcf8d39022a4a5962699c8c821c07c2dd3d6` — AGENTS.md fork directive
- `baa70a6f992cd148faefdfe617fb534bd2345e06` — specification index
- `a4c5040ede382a51b4477588e48fa9d1a67dd1b4` — machine-readable defaults
- `58502014b2c9d207e60186e064336f67dbaf5dea` — documentation audit
- `058d355f6fa053fe5080fb5be67f3c431202dd6b` — fork identity/release isolation
- `8dfd7fb928953b3b45871f9da25de7dd79f33be9` — Mac pull/worktree instructions

This handoff commit and later issue/document changes are not included in the list above. Read branch HEAD directly.

## First implementation package

Start with `F0 — Work lane and source-truth contracts`.

### Required dependency state

- Specification branch exists and is readable.
- Current event-sourced orchestration must remain canonical.
- Current provider/session/thread schemas and migration system must be inspected.
- No other implementation package may assume lane IDs or completion evidence until F0 contracts are integrated.

### Ownership boundary

The F0 owner controls:

- new lane/source-truth contract modules;
- required orchestration contract integration points;
- lane/source-truth decider commands/events/invariants;
- lane/source-truth projectors and persistence migration;
- client-runtime decode/projection changes required for compatibility;
- focused tests and documentation for F0.

The owner must avoid unrelated UI, provider adapter, node-job, notification, branding, release, and broad performance work.

Parallel agents must not edit shared orchestration contracts, decider, projector, or migration registry until the F0 owner publishes a merge contract or integrates the foundation.

### F0 acceptance rows

Primary rows:

- A01-A06
- B01-B07
- the F0-relevant portion of C01/C03
- the migration compatibility portion of P05
- source-truth visibility scaffolding required for later K/L rows

Do not mark UI rows proven during F0 unless a real applicable client surface is implemented and tested.

## First-agent mandatory start output

The first implementation agent must record:

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

It must then produce:

- plan revision;
- advisor review because this is domain/persistence work;
- exact schema/migration compatibility strategy;
- focused implementation;
- deterministic tests;
- final diff and staged list;
- verifier review;
- package completion receipt.

## Architectural warnings

- `packages/contracts/src/orchestration.ts` is already large. Prefer explicit new subpath modules and one integration owner rather than increasing parallel contention.
- Shell projections must stay compact. Do not put complete lane evidence/log payloads into the existing project/thread shell.
- Existing threads require a migration/import rule that does not falsely mark history complete.
- Completion policy belongs in the decider, not provider adapters or React.
- WorkLane is not a replacement name for Thread. A lane may own/recover across multiple provider threads.
- SourceTruthRevision is durable evidence lineage, not a cached `git status` widget.
- Do not introduce sleeps/polling in tests; use receipts and worker drains.
- Do not run development against live `~/.t3/userdata`.

## Known evidence gaps

- No local tree/worktree/status receipt was possible from the execution environment used to write the specification.
- No test command was executed.
- No TypeScript/JSON formatter was run locally.
- No rendered markdown or client UI was inspected.
- No package implementation exists yet.
- No PR was opened because the repository instructions prohibit PR creation without explicit authorization.

Agents must not convert the existence of this specification into an implementation claim.

## Campaign stop conditions

The campaign stops only when:

- every required implementation package is integrated;
- every required acceptance row is `PROVEN` on current revisions;
- the canonical Mac + Linux node + mobile E0 scenario passes;
- fork identity/release paths are isolated and verified;
- current tests/CI and user-visible acceptance are attached;
- the final completion receipt is independently verified.

A plan, documentation branch, build success, passing unit tests, or uploaded installer by itself does not satisfy the campaign.