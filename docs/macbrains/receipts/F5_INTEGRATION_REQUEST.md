# F5/F6 Integration Request — Worker C → Integrator

**From:** Worker C (Visible T3)  
**Branch/worktree:** `macbrains/f5-command-center` @ (see commit after land)  
**To:** Campaign Integrator (`macbrains/integrator-wave0` → `macbrains/integration`)

## Requested Integrator-owned wiring

1. **App navigation root / route tree**
   - Register command-center landing route (proposed: `/command-center`).
   - Register lane workspace route (proposed: `/lanes/$environmentId/$laneId`).
   - Optionally make Command Center the default landing per `DEFAULT_POLICIES.json` / K01 — do **not** leave chat-first redirect as the only home once wired.
   - Mount `apps/web/src/components/commandCenter/CommandCenterShell` (or compose `ProjectsHome` + `LaneWorkspace` directly).

2. **Package export already added (Worker C)**
   - `@t3tools/client-runtime/commandCenter` export in `packages/client-runtime/package.json`.
   - No contracts barrel change required for Wave 1 shell.

3. **Later (Wave 2 joint)**
   - Replace mock adapter with live shell projection + F3 assignment control RPCs.
   - Wire deep links from notifications/attention events to the same lane routes.

## Explicit non-requests

- Do not merge mock seed data as acceptance evidence.
- Do not duplicate this UI business logic into mobile in Wave 1 (F6 wave1Note: mobile deferred to Wave 5).

## Merge order note (from FAMILY_OWNERSHIP)

Integrator merge order: F3 contracts → F2 gate → **F5/F6 visible shell** → vertical-slice demo.
