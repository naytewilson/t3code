# MacBrains T3 Code Implementation Handoff

## Source-truth boundary

This specification was authored against GitHub-visible repository state. The execution container could not clone the repository because outbound DNS resolution failed. Therefore no local checkout, dependency installation, formatter, test, lint, build, packaged client, or rendered UI receipt exists from this specification session.

### Proven baseline identity

- Fork: `naytewilson/t3code`
- Upstream: `pingdotgg/t3code`
- Initial fork/upstream merge base: `b125b7635170ec0c33f8ddf39299155a21f8c9b9`
- Initial fork/upstream comparison: identical
- Specification branch: `macbrains/agent-workflow-overhaul`

The specification branch has advanced beyond the baseline. Agents must fetch and record its current HEAD rather than copy any historical SHA from conversation or documentation.

## Authoritative artifacts

The complete list and reading order are in `docs/macbrains/README.md`. Core machine-readable assets:

- `docs/macbrains/CAMPAIGN_MANIFEST.json`
- `docs/macbrains/WORKFLOW_TEMPLATES.json`
- `docs/macbrains/DEFAULT_POLICIES.json`

Core execution assets:

- `docs/macbrains/ORCHESTRATION_PLAN.md`
- `docs/macbrains/F0_EXECUTION_PROMPT.md`
- `docs/macbrains/AGENT_EXECUTION_PROMPT.md`
- `docs/macbrains/PULL_TO_MAC.md`

Core proof assets:

- `docs/macbrains/IMPLEMENTATION_LEDGER.md`
- `docs/macbrains/ACCEPTANCE_MATRIX.md`

Project-specific adaptation:

- `docs/macbrains/PROJECT_PROFILES.md`

Fork/release isolation:

- `docs/macbrains/FORK_IDENTITY_AND_RELEASE.md`

## Specification validation

A dependency-free validator exists:

```sh
node scripts/validate-macbrains-spec.mjs
```

A GitHub Actions workflow exists at `.github/workflows/macbrains-spec.yml` with push, pull-request, and manual triggers.

The validator checks required files, JSON syntax, package IDs/status/dependencies/cycles, required workflow templates, policy invariants, contract markers, acceptance sections, and specification-index coverage. It does not prove product implementation.

GitHub Issues are disabled in this fork. Campaign status must be maintained in `CAMPAIGN_MANIFEST.json`, `IMPLEMENTATION_LEDGER.md`, and `ACCEPTANCE_MATRIX.md`; do not create a hidden conflicting tracker.

## First implementation package

Start with `F0 — Work lane and source-truth contracts` using `F0_EXECUTION_PROMPT.md`.

### Dependency state

- Specification branch is the implementation contract source.
- Existing event-sourced orchestration remains canonical.
- Current provider/session/thread schemas and migration system must be inspected locally.
- No later package may invent lane, source-truth, receipt, or completion APIs ahead of integrated foundations.

### F0 ownership boundary

The F0 owner controls:

- lane/source-truth contract modules;
- required orchestration contract integration points;
- lane/source-truth commands, events, decider invariants, and projectors;
- persistence migration and replay compatibility;
- client-runtime decode/projection compatibility required by F0;
- focused tests and F0 documentation.

The F0 owner must not absorb unrelated provider, node, notification, branding, release, full Command Center, or broad performance work.

Parallel agents must not edit shared orchestration contracts, decider, projector, package exports, or migration registry until the F0 owner defines a merge contract or integrates the foundation.

### F0 acceptance scope

Primary rows:

- A01-A06
- B01-B07
- F0-relevant portions of C01/C03
- migration/rebuild compatibility relevant to P05
- only the source-truth shell/detail scaffolding necessary for later UI packages

Do not mark UI, provider, receipt-store, completion-gate, or node rows proven from F0 scaffolding.

## First-agent mandatory start output

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

Then produce:

- plan revision;
- independent advisor review;
- exact schema/migration/compatibility strategy;
- focused implementation;
- deterministic tests;
- final diff and staged list;
- independent verifier review;
- package completion receipt;
- updated campaign/acceptance evidence only after proof.

## Architectural warnings

- `packages/contracts/src/orchestration.ts` is already large; prefer current explicit-subpath conventions and one export integration owner.
- Keep shell projections compact; full evidence/log payloads require detail/artifact boundaries.
- Existing threads must migrate deterministically without false completion.
- Completion policy belongs in the decider, not provider adapters, transcripts, or React.
- WorkLane is not a renamed Thread; a lane may survive or own multiple provider threads.
- SourceTruthRevision is durable evidence lineage, not a cached status widget.
- Tests must use deterministic clocks, receipts, and worker drains rather than sleeps/polling.
- Never run development against live `~/.t3/userdata`.
- Remote project/worktree operations must respect existing environment authentication scopes and transport ownership.

## Known missing evidence

- No local repository/worktree/status receipt from this specification session.
- The validator was added but not run in the unavailable local checkout.
- No GitHub Actions result was observed from this session.
- No formatter, tests, lint, typecheck, build, package, or client acceptance was run.
- No implementation package has started.
- No pull request was opened because it was not explicitly authorized.
- Concrete MacBrains bundle IDs, domains, auth tenant, updater package, signing, and hosted infrastructure remain configuration decisions to verify during U0; upstream values must not be reused automatically.

Agents must not convert the existence or detail of this specification into an implementation claim.

## Campaign stop conditions

The campaign stops only when:

- every required package is integrated and `PROVEN`;
- every required acceptance row has current evidence;
- no stale check or unresolved blocker remains;
- fork identity/release isolation is proven;
- the canonical Mac + Linux node + desktop/web/iPhone/iPad E0 scenario passes;
- restart, provider failure, node disconnect, stale evidence, and recovery are demonstrated;
- the final user-visible deliverable is launchable;
- an independent verifier accepts the final evidence bundle.

A plan, documentation branch, code compilation, unit-test pass, CI green state, or installer artifact alone does not complete the campaign.