# Wave 1 Worker Launch Packets

Baseline: `57b800cd3` on `macbrains/integration`.  
Read first: `FAMILY_EXECUTION_BOARD.md`, `FAMILY_OWNERSHIP.md`, `MACBRAINS.md`, `AGENT_EXECUTION_PROMPT.md`.

---

## Worker A — Truth Gate Engineer (F2)

**Worktree:** `/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f2-completion-gate`  
**Branch:** `macbrains/f2-completion-gate`

### Job

Make “completed” mean completed. Completion must fail when any required criterion is pending, required test failed, evidence stale, verifier not accepted, deliverable missing, UI not visibly tested, or blocker open.

### Required demonstration

```text
Completion request
→ rejected because criterion is pending

Test and evidence added
→ verifier accepts
→ completion request succeeds
```

### Owns

New completion/check/evidence-staleness modules + focused tests + F2 receipts.

### Integration requests required for

Central contract exports, migration registry, server assembly.

### Close with

Standard family report block. Do not mark CAMPAIGN_MANIFEST F2 `PROVEN` yourself — Integrator updates after verifier.

---

## Worker B — Director and Worker Runtime (F3 + needed P0)

**Worktree:** `/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f3-agent-topology`  
**Branch:** `macbrains/f3-agent-topology`

### Job

Build one agent controlling others with durable roles and director tools wired to real `ProviderService` sessions in the lane worktree.

### Roles

`director` · `executor` · `advisor` · `verifier` · `recovery worker`

### Tools (equivalents)

`spawn_worker` · `send_instruction` · `request_status` · `steer_worker` · `pause_worker` · `resume_worker` · `stop_worker` · `replace_worker` · `request_review`

### Required demonstration

1. Create one lane.  
2. Start one real director provider session.  
3. Director spawns one real worker.  
4. Worker receives correct task and worktree.  
5. Worker returns a result.  
6. Director sees and responds.  
7. Session and assignment survive reconnect.

No simulated workers. No state-only transitions.

### Integration requests required for

Shared contract exports / RPC registration / provider layer assembly.

---

## Worker C — Visible T3 Experience (F5 + first F6)

**Worktree:** `/Users/nayte/Projects/ANE-Lab/worktrees/t3code-macbrains-f5-command-center`  
**Branch:** `macbrains/f5-command-center`

### Job

Make the work obvious in the app: Projects home, lane screen, agent tree, controls.

### Mock rule

UI may use replaceable mock adapters during Wave 1, but **must not invent a second domain model**. Adapters speak the real contracts.

### Required demonstration (Wave 2 joint)

Start real lane from app → see real director/worker → steer → live updates → verifier outcome → open finished deliverable. Fake static data is not acceptance.

### Integration requests required for

App navigation root and any shared projection export wiring.

---

## Joint Wave 2 acceptance (Integrator coordinates)

```text
truthful completion
+ real director
+ one real worker
+ visible agent tree
+ one real verifier
```
