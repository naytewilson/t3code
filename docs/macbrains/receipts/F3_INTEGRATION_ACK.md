# F3 Integration request — Integrator ACK

**From:** Campaign Integrator  
**Re:** [Worker B — F3 Director Runtime](a9bbe217-45ed-414a-be0c-058377c3ab6b)  
**Slice:** `681fda1b7` · tip `5d9dda0da` on `macbrains/f3-agent-topology`  
**Date:** 2026-07-31

## Actions taken

| Item | Status |
|---|---|
| Confirm tip pushed to origin | pending this ACK push |
| Review focused test claim (6/6 via temp primary `node_modules` link) | **ACCEPTED as PROVEN for unit slice** — live provider CLI still UNMEASURED |
| Wire AssignmentStore + DirectorRuntime into server Layer assembly | **HOLD** — Integrator-owned; needs careful Layer composition + typecheck on RAM ADMIT |
| Root barrel / RPC for director tools | **HOLD** — subpath `@t3tools/contracts/agentAssignment` sufficient until F5 binds |
| Merge into `macbrains/integration` | **HOLD** until assembly wire + ADMIT typecheck; merge order F3 → F2 → F5 |
| Flip CAMPAIGN_MANIFEST F3 → PROVEN | **HOLD** until Wave 2 live provider demo |

## Next

1. On ADMIT: typecheck F3 worktree; wire `makeDirectorRuntime` + `makeInMemoryAssignmentStore` into server assembly.
2. Then FF-merge F3 → `macbrains/integration` ahead of F2/F5.
3. RPC/topology projection when F5 controls bind live (not mock).
