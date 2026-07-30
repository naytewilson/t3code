# F0 Downgrade / Rollback

Automatic downgrade from F0 (work lanes + source-truth events) is **not supported**.

## Why

New orchestration event types (`lane.*`, `source-truth.*`) and projection tables are append-only. Older server binaries that do not know these event types will fail schema decode when reading the event stream or rebuilding projections.

## Rollback procedure

1. Stop the newer server.
2. Restore `state.sqlite` (and `-wal`/`-shm` siblings) from a pre-upgrade backup taken while no writer held the DB open.
3. Restore any paired `secrets` / `settings.json` only if the backup set included them.
4. Start the older binary against the restored database.

Do not attempt to delete only the new events/tables in place and continue on an old binary — event sequences and projector cursors will diverge.

## Forward-only note

If you must keep the upgraded database, stay on an F0-capable server build. Clients without `workLanes` capability should ignore lane shell fields via decode defaults.
