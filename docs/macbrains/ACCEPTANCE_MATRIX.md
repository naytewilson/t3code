# MacBrains T3 Code Acceptance Matrix

## Rules

- `PROVEN` requires observed tool output or an attached artifact from the exact tested revision.
- `INFERRED` cannot satisfy a required acceptance criterion.
- A passing test from an older HEAD is stale.
- A skipped required check is not a pass.
- UI functionality requires integrated evidence on every applicable surface.
- The final verifier must independently inspect current repository state and receipts.

Each row must be updated with:

- status;
- commit SHA;
- environment/build version;
- receipt IDs;
- artifact links;
- tester/verifier assignment;
- exact failures or caveats.

## A. Repository and source truth

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| A01 | Every substantial lane records repository root, branch, HEAD, worktree, dirty state, remotes, operations, instructions, manifests, relevant files, tests, and ownership risks before edits | Preflight receipt from exact worktree | NOT_STARTED |
| A02 | Narrative memory cannot override contradictory repository or canonical-source evidence | Conflict test with persisted authorities and blocked transition | NOT_STARTED |
| A03 | Source truth can be refreshed and revisions are preserved | Event/projection test and UI revision history | NOT_STARTED |
| A04 | Active merge/rebase/cherry-pick/bisect/revert state blocks unsafe execution | Integration tests in temporary repos | NOT_STARTED |
| A05 | Generated and vendored boundaries are visible and respected | Preflight fixture and ownership test | NOT_STARTED |
| A06 | Unknowns that change action become typed blockers; irrelevant unknowns do not halt work | Decider tests | NOT_STARTED |

## B. Work lanes and lifecycle

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| B01 | Lane persists independently of provider session/thread | Restart and provider replacement test | NOT_STARTED |
| B02 | Lifecycle allows only documented transitions | Exhaustive transition matrix | NOT_STARTED |
| B03 | Substantial lane cannot execute without current preflight/worktree | Negative decider tests | NOT_STARTED |
| B04 | Provider message cannot mark lane completed | Regression test | NOT_STARTED |
| B05 | Completion can be invalidated by stale/false evidence | End-to-end invalidation test | NOT_STARTED |
| B06 | Existing threads migrate without false completion | Migration fixtures | NOT_STARTED |
| B07 | Cancel, supersede, block, unblock, and recovery states have reverse/continuation paths | Command/event/projection tests and UI controls | NOT_STARTED |

## C. Worktrees and ownership

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| C01 | Substantial work creates or attaches to an isolated worktree by default | Real Git integration test | NOT_STARTED |
| C02 | UI shows base SHA, branch, worktree path, status, and owner | Web/mobile screenshots | NOT_STARTED |
| C03 | Same worktree cannot be owned by two active lanes | Invariant test | NOT_STARTED |
| C04 | Overlapping file/path ownership is detected before execution and merge | Multi-lane fixture | NOT_STARTED |
| C05 | Shared-file work requires an explicit merge contract | Negative/positive tests | NOT_STARTED |
| C06 | Dirty worktree deletion/refactoring is refused without typed force intent | Real Git test | NOT_STARTED |
| C07 | Remote GUI creates project and worktree on Linux node | Desktop/mobile remote integration | NOT_STARTED |
| C08 | Worktree setup scripts emit structured receipts and do not touch live profile | Integration test | NOT_STARTED |

## D. Agent topology and routing

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| D01 | Executor, advisor, verifier, explorer, child, and recovery roles are durable and visible | Contract/projector/UI tests | NOT_STARTED |
| D02 | Assignment records provider instance, model intent, resolved model, reasoning, tools, environment, and ownership | Schema roundtrip and UI | NOT_STARTED |
| D03 | Architecture/high-risk plan requires advisor before execution | Invariant tests | NOT_STARTED |
| D04 | Verifier independently refreshes source truth | Review receipt validation test | NOT_STARTED |
| D05 | Parallel editing is blocked without disjoint ownership | Assignment conflict tests | NOT_STARTED |
| D06 | Child agents are visible with parent, task, ownership, status, and output | Provider simulation and UI | NOT_STARTED |
| D07 | Recovery agent supersedes failed context without erasing history | Recovery scenario | NOT_STARTED |
| D08 | Model escalation records task-specific cause | Routing event test | NOT_STARTED |
| D09 | Saved workflows survive model name removal by resolving model intent | Capability-resolution migration test | NOT_STARTED |

## E. Provider behavior

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| E01 | Codex adapter maps normalized lifecycle/tool/child/context events | Adapter test suite | NOT_STARTED |
| E02 | Claude Code adapter maps normalized events | Adapter test suite | NOT_STARTED |
| E03 | Cursor adapter maps normalized events and does not replay duplicate history on resume | Regression test | NOT_STARTED |
| E04 | Grok Build adapter has explicit capability matrix | Contract snapshot | NOT_STARTED |
| E05 | OpenCode adapter has explicit capability matrix | Contract snapshot | NOT_STARTED |
| E06 | Unsupported features are visible, not silently absent | Capability UI test | NOT_STARTED |
| E07 | Provider instance/account routing remains correct across restart | Multi-instance integration | NOT_STARTED |
| E08 | Context meter reflects compaction rather than monotonically increasing | Compaction regression | NOT_STARTED |
| E09 | Provider replay is deduplicated across session/resume epochs | Replay fixtures | NOT_STARTED |

## F. Background work and context recovery

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| F01 | Background subagent/job activity keeps session alive through explicit lease | Deterministic reaper test | NOT_STARTED |
| F02 | Foreground turn completion alone does not kill active background work | Regression scenario > threshold virtual clock | NOT_STARTED |
| F03 | Abandoned leases expire and session is reaped | Virtual clock test | NOT_STARTED |
| F04 | Context handoff contains task, source truth, plan, edits, checks, blockers, and next action | Schema and snapshot test | NOT_STARTED |
| F05 | Provider switch/recovery resumes from canonical handoff | End-to-end recovery | NOT_STARTED |
| F06 | Running node work survives provider context replacement | Cross-runtime test | NOT_STARTED |

## G. Receipts and evidence

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| G01 | Every receipt has stable ID, schema version, lane, environment, producer, timestamp, source revision, labels, payload, and hash | Schema tests | NOT_STARTED |
| G02 | Content hash detects mutation | Tamper test | NOT_STARTED |
| G03 | Large logs are artifact references, not shell projection payloads | Payload-size test | NOT_STARTED |
| G04 | Superseded receipts remain auditable | Projection/query test | NOT_STARTED |
| G05 | Evidence export is deterministic and hash-verifiable | Repeated export comparison | NOT_STARTED |
| G06 | Claims use only PROVEN/INFERRED/SUSPECTED/UNKNOWN | Validation tests | NOT_STARTED |
| G07 | Every reactor emits success or failure receipt | Reactor test coverage | NOT_STARTED |
| G08 | Receipt query supports lane/kind/criterion/check/assignment/revision filters | Query tests | NOT_STARTED |

## H. Checks and completion

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| H01 | Check statuses exactly match canonical vocabulary | Schema test | NOT_STARTED |
| H02 | Required failed, blocked, stale, not-run, or unpermitted skipped check blocks completion | Truth-table tests | NOT_STARTED |
| H03 | Relevant source or dependency change marks check stale | Fingerprint integration | NOT_STARTED |
| H04 | Completion requires verifier receipt | Negative invariant test | NOT_STARTED |
| H05 | UI change requires passing UI acceptance receipt | Negative invariant test | NOT_STARTED |
| H06 | Completion report includes six mandated closeout fields | Schema and UI test | NOT_STARTED |
| H07 | No unresolved blocker at completion | Invariant test | NOT_STARTED |
| H08 | Completion receipt links final commit/branch/PR, diff, checks, deliverables, and claims | End-to-end receipt | NOT_STARTED |

## I. Linux node

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| I01 | Linux node is a first-class authenticated environment | Environment UI and API test | NOT_STARTED |
| I02 | Node capability snapshot includes OS/arch/toolchain/resources/service/providers | Snapshot test | NOT_STARTED |
| I03 | Node job pins source commit and input hashes | Contract/invariant test | NOT_STARTED |
| I04 | Python implementation, worker prompt, and generated script are rejected | Validation fixtures | NOT_STARTED |
| I05 | Job supports queue, cancel, disconnect/reconnect, recovery | Integration tests | NOT_STARTED |
| I06 | Full logs preserved as artifacts; UI receives bounded summaries | Payload and artifact test | NOT_STARTED |
| I07 | Outputs are content-addressed and hash-verified | Tamper/transfer tests | NOT_STARTED |
| I08 | Node completion is distinct from Mac integration | State-machine test | NOT_STARTED |
| I09 | Stale source blocks blind integration | Integration negative test | NOT_STARTED |
| I10 | Mac reruns applicable verification after integration | End-to-end receipt chain | NOT_STARTED |
| I11 | ANVIL is uppercase except exact case-sensitive values | Policy validation tests | NOT_STARTED |

## J. Remote and mobile

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| J01 | iPhone/iPad can pair over authenticated Tailscale-compatible endpoint | Real-device evidence | NOT_STARTED |
| J02 | Mobile can add remote project | Real-device evidence | NOT_STARTED |
| J03 | Mobile can create isolated lane/worktree | Real-device evidence | NOT_STARTED |
| J04 | Mobile can start, steer, queue, pause, resume, interrupt, and recover | Scenario recordings | NOT_STARTED |
| J05 | Mobile shows source truth, agents, diff, checks, receipts, node jobs, blockers, and deliverables | Screenshots and navigation test | NOT_STARTED |
| J06 | Offline cache is clearly distinguished from live state | Connection-state tests | NOT_STARTED |
| J07 | Reconnect does not allow stale cache to overwrite newer live data | Deterministic runtime test | NOT_STARTED |
| J08 | Hosted HTTPS app refuses insecure mixed-content backend path with clear guidance | Browser test | NOT_STARTED |
| J09 | Remote project/worktree management no longer requires server-side CLI workaround | End-to-end proof | NOT_STARTED |

## K. Command Center and UX

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| K01 | Command Center is default landing surface | Web/desktop/mobile screenshot | NOT_STARTED |
| K02 | Needs-attention section is event-derived and actionable | Projection/deep-link tests | NOT_STARTED |
| K03 | Active work shows all environments and role/model state | Seeded data test | NOT_STARTED |
| K04 | Ready-for-review and ready-to-use are distinct states | Projection/UI tests | NOT_STARTED |
| K05 | Node activity visible without opening transcript | UI test | NOT_STARTED |
| K06 | Every card deep-links to exact lane/evidence/action | Navigation tests | NOT_STARTED |
| K07 | No continuously repainting animation | Code review and performance capture | NOT_STARTED |
| K08 | Large lists are virtualized and responsive | Seeded benchmark | NOT_STARTED |
| K09 | Chat remains available but is not the sole project state surface | UX acceptance | NOT_STARTED |

## L. Diff, plans, and review

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| L01 | Plans are versioned and strategy changes record rationale | Event/projection tests | NOT_STARTED |
| L02 | Plan maps files/symbols/checks to acceptance criteria | UI and schema test | NOT_STARTED |
| L03 | Diff supports lane, staged/unstaged, base-to-head, and commits | Integration UI | NOT_STARTED |
| L04 | Cross-lane overlaps visible before merge | Multi-lane UI | NOT_STARTED |
| L05 | Generated/vendor filtering available | Diff fixture | NOT_STARTED |
| L06 | Tests trace to changed behavior/acceptance criteria | Check mapping UI | NOT_STARTED |
| L07 | Verifier findings carry severity, evidence, status, and resolution | Review workflow test | NOT_STARTED |
| L08 | Restore checkpoint does not erase audit history | Checkpoint/recovery test | NOT_STARTED |

## M. Deliverables and visibility

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| M01 | Finished lane has persistent deliverable or explicit approved none | Completion invariant | NOT_STARTED |
| M02 | Deliverable records provenance and acceptance receipts | Schema test | NOT_STARTED |
| M03 | Launch/open action is tested | UI acceptance receipt | NOT_STARTED |
| M04 | Missing/invalid output becomes invalidated, not ready | Filesystem/URL test | NOT_STARTED |
| M05 | Deliverables appear after restart on desktop/mobile | Persistence scenario | NOT_STARTED |
| M06 | App/dashboard changes include obvious access path | End-to-end user acceptance | NOT_STARTED |
| M07 | Hidden daemon/log/database-only result cannot satisfy visible delivery | Negative completion test | NOT_STARTED |

## N. Notifications

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| N01 | Approval/input notification opens exact request | Mobile/desktop deep link | NOT_STARTED |
| N02 | Failure/blocker notification opens exact evidence and action | Scenario test | NOT_STARTED |
| N03 | Advisor conflict and verifier rejection are distinct | Projection tests | NOT_STARTED |
| N04 | Check/CI/PR state changes deduplicate | Notification tests | NOT_STARTED |
| N05 | Node completion/failure notification distinguishes integration status | Scenario test | NOT_STARTED |
| N06 | Ready-to-use notification only after completion invariant | Negative/positive tests | NOT_STARTED |
| N07 | Notifications persist and resolve across devices | Multi-device test | NOT_STARTED |

## O. GitHub integration

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| O01 | Detect GitHub remotes for HTTPS and arbitrary SCP-style SSH user | Parser tests | NOT_STARTED |
| O02 | Private repository access failure is actionable | Integration error test | NOT_STARTED |
| O03 | Lane links issue/PR/current head/checks/reviews/threads | UI/API test | NOT_STARTED |
| O04 | Stale PR head is detected | GitHub fixture | NOT_STARTED |
| O05 | PR only created when authorized | Invariant test | NOT_STARTED |
| O06 | Target branch updated/rebased before PR as policy requires | Workflow receipt | NOT_STARTED |
| O07 | Bot/reviewer findings are verified against source before action | Review workflow test | NOT_STARTED |

## P. Persistence and resilience

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| P01 | Critical JSON uses atomic same-filesystem replace and backup | Fault injection | NOT_STARTED |
| P02 | Truncated/NUL/corrupt catalog recovers last-known-good or opens repair UI | Corruption tests | NOT_STARTED |
| P03 | Unchanged catalog is not rewritten every few seconds | File-write instrumentation | NOT_STARTED |
| P04 | One corrupt thread does not brick environment | Isolation test | NOT_STARTED |
| P05 | Projections can rebuild from canonical events | Rebuild test | NOT_STARTED |
| P06 | Heavy thread does not crash app or require deleting `.t3` | Soak test | NOT_STARTED |
| P07 | Live userdata is never opened read-write by dev worktree | Integration guard test | NOT_STARTED |

## Q. Performance

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| Q01 | Idle client produces no VCS request storm | 30-minute clean-profile trace | NOT_STARTED |
| Q02 | Automatic fetch disabled means no fetch-derived refresh | Trace test | NOT_STARTED |
| Q03 | 100 projects/1000 lanes remain navigable | Seeded benchmark | NOT_STARTED |
| Q04 | Shell projection omits full transcripts/logs/receipts | Payload measurement | NOT_STARTED |
| Q05 | Heavy log parsing/diff work stays off UI thread | Profile capture | NOT_STARTED |
| Q06 | Mobile scrolling remains responsive under large data | Real-device profile | NOT_STARTED |
| Q07 | Reconnect under server load succeeds without false offline state | Load scenario | NOT_STARTED |

## R. Security and permissions

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| R01 | Remote-capable endpoint requires authentication | Integration test | NOT_STARTED |
| R02 | Pairing token never appears in hosted query parameter | URL test | NOT_STARTED |
| R03 | Sensitive provider values never return after save | API test | NOT_STARTED |
| R04 | Lane displays effective access/tool policy | UI test | NOT_STARTED |
| R05 | Destructive commands are scoped and typed | Contract/invariant tests | NOT_STARTED |
| R06 | No pattern-based process killing | Static search and runtime test | NOT_STARTED |
| R07 | Cross-environment artifact transfer is audited and hash-checked | Transfer receipts | NOT_STARTED |
| R08 | Dev/test cannot mutate live profile | Guard test | NOT_STARTED |

## S. Fork identity and maintainability

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| S01 | App/package/data IDs do not collide with upstream | Artifact inspection | NOT_STARTED |
| S02 | MacBrains branding appears consistently on web/desktop/mobile | Screenshots | NOT_STARTED |
| S03 | About shows upstream base and fork commit | UI test | NOT_STARTED |
| S04 | Upstream sync procedure is documented and tested | Dry-run receipt | NOT_STARTED |
| S05 | Upstream profile import is explicit, reversible, and does not overwrite | Migration test | NOT_STARTED |
| S06 | Hosted upstream services are not used accidentally | Network/config audit | NOT_STARTED |
| S07 | New fork-specific code is isolated in explicit modules/subpaths where practical | Diff review | NOT_STARTED |

## T. Project instructions and skills

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| T01 | UI shows loaded instruction files/bundles and precedence | UI test | NOT_STARTED |
| T02 | Repository instructions outrank reusable skill instructions | Conflict test | NOT_STARTED |
| T03 | Skill version/hash/validation/requirements are persisted | Schema test | NOT_STARTED |
| T04 | Invalid skill cannot execute | Negative test | NOT_STARTED |
| T05 | ANVIL/source-truth templates are selectable | UI and generated contract | NOT_STARTED |
| T06 | Skill usage history is auditable | Projection test | NOT_STARTED |

## U. End-to-end acceptance

| ID | Requirement | Required proof | Status |
|---|---|---|---|
| U01 | Canonical Mac + Linux node + mobile scenario completes | Full acceptance bundle | NOT_STARTED |
| U02 | Restart preserves state and control | Restart video + receipt export | NOT_STARTED |
| U03 | Provider failure recovers through new assignment | Recovery evidence | NOT_STARTED |
| U04 | Stale evidence invalidates completion and can be repaired | Invalidation scenario | NOT_STARTED |
| U05 | User can open and use final deliverable | Recorded acceptance | NOT_STARTED |
| U06 | Final completion report contains exact proof and caveats | Completion receipt | NOT_STARTED |

## Final release gate

Release is blocked unless:

- every required row is `PROVEN`;
- no `PROVEN` row references stale commits or missing artifacts;
- all known high/critical verifier findings are resolved;
- desktop, web, iPhone, and iPad applicable paths pass;
- Mac and Linux-node canonical scenario passes after clean restart;
- fork identity does not collide with upstream;
- the final evidence bundle can be independently verified from hashes and repository state.