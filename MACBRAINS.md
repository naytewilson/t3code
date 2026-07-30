# MacBrains T3 Code Operating Contract

This fork is the user-facing control plane for Nayte's coding agents, repositories, Mac, and Linux compute node. It is not a generic chat launcher.

## Authority

Apply this precedence whenever instructions conflict:

1. current repository state and repository-scoped instructions;
2. canonical project records, manifests, databases, CI, and experiment ledgers;
3. current command output and durable receipts;
4. approved handoff documents;
5. conversation narrative.

Never use remembered state as a substitute for reading the real repository. Every state-changing run starts with a read-only source-truth preflight.

## Required run lifecycle

Every substantial run MUST visibly pass through these durable states:

`queued -> preflight -> oriented -> planned -> executing -> testing -> reviewing -> deliverable-ready -> completed`

Additional terminal states:

`blocked`, `failed`, `cancelled`, `superseded`, `recovery-required`.

A provider saying it is done does not complete a run. Completion is decided by the orchestration layer only after required receipts exist.

## Mandatory receipts

A run cannot enter `completed` without all applicable receipts:

- repository identity, branch, HEAD, worktree, dirty state, and instruction files;
- ownership and overlap assessment;
- plan and acceptance criteria;
- files changed and final diff summary;
- commands executed with exit status;
- tests, lint, typecheck, build, and UI validation results;
- staged file list or explicit statement that nothing is staged;
- user-visible launch or access path;
- screenshots or recordings for UI changes;
- unresolved risks and missing evidence;
- final verdict using `PROVEN`, `INFERRED`, `SUSPECTED`, and `UNKNOWN`.

No spinner, assistant message, or provider process state may impersonate these receipts.

## Worktree isolation

Substantial repository work uses one isolated Git worktree per implementation lane. The UI must show:

- repository;
- base branch and base SHA;
- lane branch;
- worktree path;
- owner agent;
- changed files;
- ahead/behind and conflict status;
- whether another live lane overlaps the same files.

Never silently edit the primary checkout when an isolated lane is available. Never clean, reset, switch, delete, or repurpose another lane without explicit evidence that it is abandoned and safe.

## Agent topology

Default substantial topology:

1. **Executor** performs inspection, edits, and focused validation.
2. **Advisor** reviews the approach after orientation and before irreversible or broad edits.
3. **Verifier** independently reviews the finished diff, evidence, and acceptance criteria.

Do not fan out multiple editors into overlapping files. Parallel agents require explicit ownership boundaries and merge contracts.

Preserve productive explorer context, but transfer claims to an independent canonical verifier before treating them as fact.

## Model routing

Use the smallest sufficient model and reasoning level.

- routine bounded work: lower-cost executor;
- normal implementation and research: medium reasoning;
- architecture, migrations, concurrency, security, performance, and provenance: executor + stronger advisor + independent verifier;
- escalate only after task-specific failure evidence.

The UI must store the selected role, provider instance, model, reasoning level, and escalation cause for every agent lane.

## Mac and Linux node

The Mac is the interactive control and integration surface. The Linux node is a first-class execution environment for heavy builds, tests, benchmarks, analysis, and long-running jobs.

Node rules:

- no Python implementation or Python-based worker prompts;
- prefer C, C++, Rust, Swift where supported, shell, or another native compiled implementation;
- show the exact environment and filesystem owning every command;
- preserve artifacts and return them through typed receipts;
- do not imply that node output is integrated until the Mac repository has received and verified it.

For ANVIL, always write `ANVIL` uppercase except in case-sensitive identifiers, commands, and paths.

## Visible completion

Backend implementation is not completion. Every durable feature must have:

- an obvious UI surface;
- a launch or access path;
- persistent visibility after restart;
- notifications when attention is required;
- a demonstrated end-to-end acceptance check that Nayte can see and use.

A hidden daemon, database row, log file, or command without a discoverable UI does not count as delivered.

## Remote and mobile

Web, desktop, iPhone, and iPad are first-class control surfaces. A workflow that can start on desktop must remain observable and controllable remotely unless the operation is inherently local-only.

Required remote capabilities include:

- add and manage projects on remote environments;
- create and inspect worktrees;
- start, interrupt, steer, queue, resume, and recover runs;
- view live logs, diff, tests, receipts, blockers, and agent topology;
- receive actionable notifications;
- open the exact repository, branch, PR, artifact, or dashboard involved.

Never expose a public backend without authenticated access. Prefer Tailscale endpoints and preserve the existing environment/access-endpoint boundary.

## User interaction

Do not force repeated gates or ceremonial confirmations. Ask only when missing information changes the correct action or an irreversible boundary requires explicit consent.

For authorized repository work, proceed through the full lifecycle and stop only at a real blocker or completed acceptance contract. Surface blockers with exact evidence and the smallest safe next action.

## Completion report

Every completed or blocked run must close with these fields:

- `proven`
- `missing evidence`
- `possibly wrong or overstated`
- `exact next action`
- `what does not count as completion`
- `safe to continue here or start a fresh context`

## Implementation map

The complete product and engineering specification is in:

- `docs/macbrains/PRODUCT_SPEC.md`
- `docs/macbrains/DOMAIN_MODEL.md`
- `docs/macbrains/IMPLEMENTATION_LEDGER.md`
- `docs/macbrains/ACCEPTANCE_MATRIX.md`
- `docs/macbrains/AGENT_EXECUTION_PROMPT.md`

Agents must read all five before changing behavior governed by this fork.