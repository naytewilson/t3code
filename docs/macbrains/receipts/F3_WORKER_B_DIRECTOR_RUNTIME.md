# F3 Worker B — Director / Worker Runtime Receipt

**Agent:** WorkerB-F3-Topology  
**Worktree:** `/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f3-agent-topology`  
**Branch:** `macbrains/f3-agent-topology`  
**Date:** 2026-07-31  
**Baseline tip before slice:** `4d1c3798e`

## Slice delivered

Focused F3 modules (no shared barrel / RPC / server-layer assembly edits):

| Path                                                                | Role                                                                                      |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/contracts/src/agentAssignment.ts`                         | Durable roles, assignment aggregate, director tool payloads, topology projection          |
| `packages/contracts/src/agentAssignment.test.ts`                    | Contract decode + tool list coverage                                                      |
| `packages/contracts/package.json`                                   | Subpath export `./agentAssignment` only (not public barrel)                               |
| `apps/server/src/orchestration/assignments/AssignmentStore.ts`      | Durable snapshot/restore assignment store                                                 |
| `apps/server/src/orchestration/assignments/DirectorRuntime.ts`      | Real `ProviderService.startSession` / `sendTurn` / `interruptTurn` / `stopSession` wiring |
| `apps/server/src/orchestration/assignments/DirectorRuntime.test.ts` | End-to-end spawn path against recording ProviderService                                   |
| `apps/server/src/orchestration/assignments/index.ts`                | Ownership barrel for Integrator wiring                                                    |

## Demo path exercised in tests (PROVEN)

1. Start director assignment → `ProviderService.startSession` with lane worktree cwd
2. `spawn_worker` → real `startSession` + `sendTurn` with task + worktree metadata
3. `ingestWorkerResult` → director `sendTurn` with worker result notice
4. Control tools: steer / pause / resume / replace / request_review
5. Reconnect: clear live sessions → `rehydrate` relaunches via `startSession` + resumeCursor

No simulated workers. Status changes only after ProviderService calls.

## Tests run

```text
Node 24.13.1
vp test run packages/contracts/src/agentAssignment.test.ts \
  apps/server/src/orchestration/assignments/DirectorRuntime.test.ts
→ 2 files, 6 tests passed
```

Deps were resolved via temporary links to primary `t3code` `node_modules` (Mac XL RAM admit was WAIT; no `pnpm install` in this worktree). Links removed after the run.

## Integration requirements (Integrator)

1. Export `@t3tools/contracts` barrel entry for `agentAssignment` **or** keep subpath and document it.
2. Wire `AssignmentStore` + `DirectorRuntime` into server layer assembly.
3. Optional: RPC surface for director tools / topology projection.
4. Optional: promote AssignmentStore to event-sourced projection + migration.
5. Do **not** mark CAMPAIGN_MANIFEST F3 `PROVEN` until Wave 2 live provider demo.

## Not claimed

- Live provider CLI demo in a running T3 server UI
- Orchestration command/event union membership for `agent-assignment.*`
- Desktop/web/mobile topology UI (F5/F6)
- Full F3 ledger proof matrix (ownership conflicts, multi-device sync)
