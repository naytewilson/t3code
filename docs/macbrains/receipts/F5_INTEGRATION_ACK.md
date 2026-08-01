# F5/F6 Integration request — Integrator ACK

**From:** Campaign Integrator  
**Re:** [Worker C — Visible T3](c2a83ac1-3c32-4fb0-b02e-e84e5e613772)  
**Impl:** `d761cee9b` · tip `ef918c6a0` on `macbrains/f5-command-center`  
**Date:** 2026-07-31

## Actions taken

| Item | Status |
|---|---|
| Confirm tip pushed to origin | pending this ACK push |
| Shell modules reviewed (Projects home, lane workspace, agent tree, mock adapter on real types) | **ACCEPTED as authored** — mock seed is not Wave 2 acceptance |
| Register `/command-center` + `/lanes/$environmentId/$laneId` in app navigation root | **HOLD** — Integrator-owned; RAM XL WAIT blocks `vp i` / focused UI tests |
| Make Command Center default landing | **HOLD** — after routes land and F3/F2 live adapters exist |
| Merge into `macbrains/integration` | **HOLD** — after F3 assembly + F2 gate land per FAMILY_OWNERSHIP order |
| Flip CAMPAIGN_MANIFEST F5/F6 → PROVEN | **HOLD** |

## Next

1. On ADMIT: `vp i` in F5 worktree; run command-center focused tests.
2. Integrator wires routes in `apps/web/src/router.ts` (and related) mounting `CommandCenterShell`.
3. Wave 2: swap mock adapter → live F2/F3 projections; never treat mock seed as demo evidence.
