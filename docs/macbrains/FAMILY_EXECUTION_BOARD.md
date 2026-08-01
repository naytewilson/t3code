# MacBrains Family Execution Board

**Authority:** Nayte directive 2026-07-31.  
**Integrator worktree:** `/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-integrator-wave0`  
**Canonical integration branch:** `macbrains/integration` @ `57b800cd3`

## Target milestone (Wave 2)

> A visible director in T3 spawning one real worker, controlling it, sending the result to one real verifier, and being prevented from claiming completion until the evidence is valid.

## Active Wave 1 packages

| Role | Package | Branch | Worktree |
|---|---|---|---|
| Integrator | Wave 0 control + shared integration | `macbrains/integrator-wave0` / `macbrains/integration` | `.../t3code-macbrains-integrator-wave0` + `.../t3code-macbrains-integration` |
| Worker A — Truth Gate | F2 | `macbrains/f2-completion-gate` | `.../t3code-macbrains-f2-completion-gate` |
| Worker B — Director Runtime | F3 (+ necessary P0) | `macbrains/f3-agent-topology` | `.../t3code-macbrains-f3-agent-topology` |
| Worker C — Visible T3 | F5 + first useful F6 | `macbrains/f5-command-center` | `.../t3code-macbrains-f5-command-center` |

## Wave order

0. Establish control (Integrator) — baseline, tracking, Node 24, hooks, worktrees, ownership  
1. Build core in parallel — F2, F3 assignments/spawn, F5/F6 shells with replaceable mocks, upstream touchpoint scaffolding  
2. First visible vertical slice — truthful completion + real director + one real worker + agent tree + verifier  
3. Automatic closeout — tests, repair, commit, integrate, cleanup, GitHub evidence  
4. Survival — provider replacement, node jobs, restart persistence  
5. Remote control — browser/desktop/iPhone/iPad + actionable notifications  
6. Update/release survival — upstream shadow merge, identity, updater  
7. Final E0 acceptance

## Shared-file rule

Only the Integrator may casually edit:

- central contract exports;
- RPC-group registration;
- migration registration;
- server-layer assembly;
- `CAMPAIGN_MANIFEST.json`;
- acceptance matrix;
- application navigation root.

Each engineer owns new focused modules and submits an explicit integration request.

## Required closeout report

Every worker closes with:

```text
PROVEN
MISSING EVIDENCE
FILES CHANGED
TESTS RUN
RECEIPTS AND ARTIFACTS
POSSIBLY WRONG OR OVERSTATED
EXACT NEXT ACTION
INTEGRATION REQUIREMENTS
```

Every `PROVEN` claim must identify the exact commit and test environment.

## Hard prohibitions

- Do not work directly in primary `main`.
- Do not use live user data for development.
- Do not launch hidden subagents.
- Do not share worktrees between active editors.
- Do not mark completion from an agent’s narrative.
- Do not build more backend state without a planned visible consumer.
- Do not delete a worktree containing the only copy of work.
- Do not merge unverified shared-contract changes.
- Do not routinely bypass hooks.
- Do not use Python for ANVIL/node implementation.
- Do not start mobile by duplicating web business logic.
- Do not let upstream sync directly modify the proven product branch.
