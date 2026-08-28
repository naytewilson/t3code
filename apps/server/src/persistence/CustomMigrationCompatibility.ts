import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export const CUSTOM_MIGRATIONS_TABLE = "t3_custom_schema_migrations";
export const LEGACY_WORK_LANES_MIGRATION_ID = 35;
export const LEGACY_WORK_LANES_MIGRATION_NAME = "WorkLanesAndSourceTruth";
export const CUSTOM_WORK_LANES_MIGRATION_ID = 1;

const REQUIRED_LEGACY_WORK_LANE_TABLES = [
  "projection_work_lanes",
  "projection_source_truth_revisions",
  "projection_lane_acceptance_criteria",
] as const;

export interface CustomMigrationCompatibilityResult {
  readonly legacyWorkLanesMigrationDetected: boolean;
  readonly addedTitleRegenerationColumns: ReadonlyArray<string>;
  readonly adoptedLegacyWorkLanesMigration: boolean;
}

const tableExists = Effect.fn("customMigrationCompatibility.tableExists")(function* (name: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ readonly name: string }>`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ${name}
    LIMIT 1
  `;
  return rows.length > 0;
});

const ensureCustomMigrationTable = Effect.fn(
  "customMigrationCompatibility.ensureCustomMigrationTable",
)(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE IF NOT EXISTS t3_custom_schema_migrations (
      migration_id INTEGER PRIMARY KEY NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
});

/**
 * Bridge the one known collision between the historical custom fork and upstream.
 *
 * The old custom fork recorded migration 35 as WorkLanesAndSourceTruth in
 * effect_sql_migrations. Upstream v0.0.35 also uses id 35, for the title-regeneration
 * columns. Effect's migrator skips ids <= the latest recorded id, so an old custom
 * database would otherwise skip upstream 35 and later fail when code reads the
 * missing columns.
 *
 * This bridge deliberately leaves effect_sql_migrations row 35 untouched. When that row
 * is the legacy custom migration, it installs only the idempotent upstream-35 schema
 * additions, verifies the private tables implied by the historical row, and adopts the
 * private migration into a separate custom namespace for future fork-only migrations.
 */
export const runCustomMigrationCompatibilityBridge = Effect.fn(
  "runCustomMigrationCompatibilityBridge",
)(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* ensureCustomMigrationTable();

  if (!(yield* tableExists("effect_sql_migrations"))) {
    return {
      legacyWorkLanesMigrationDetected: false,
      addedTitleRegenerationColumns: [],
      adoptedLegacyWorkLanesMigration: false,
    } satisfies CustomMigrationCompatibilityResult;
  }

  const legacyRows = yield* sql<{ readonly name: string }>`
    SELECT name
    FROM effect_sql_migrations
    WHERE migration_id = ${LEGACY_WORK_LANES_MIGRATION_ID}
    LIMIT 1
  `;
  const legacyName = legacyRows[0]?.name;
  if (legacyName !== LEGACY_WORK_LANES_MIGRATION_NAME) {
    return {
      legacyWorkLanesMigrationDetected: false,
      addedTitleRegenerationColumns: [],
      adoptedLegacyWorkLanesMigration: false,
    } satisfies CustomMigrationCompatibilityResult;
  }

  if (!(yield* tableExists("projection_threads"))) {
    return yield* Effect.fail(
      new Error(
        "Legacy migration 35_WorkLanesAndSourceTruth is recorded, but projection_threads is missing",
      ),
    );
  }

  const missingPrivateTables: Array<string> = [];
  for (const table of REQUIRED_LEGACY_WORK_LANE_TABLES) {
    if (!(yield* tableExists(table))) {
      missingPrivateTables.push(table);
    }
  }
  if (missingPrivateTables.length > 0) {
    return yield* Effect.fail(
      new Error(
        `Legacy migration 35_WorkLanesAndSourceTruth is recorded, but required private tables are missing: ${missingPrivateTables.join(", ")}`,
      ),
    );
  }

  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;
  const columnNames = new Set(columns.map((column) => column.name));
  const addedTitleRegenerationColumns: Array<string> = [];

  if (!columnNames.has("title_regeneration_request_id")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN title_regeneration_request_id TEXT
    `;
    addedTitleRegenerationColumns.push("title_regeneration_request_id");
  }

  if (!columnNames.has("title_regeneration_started_at")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN title_regeneration_started_at TEXT
    `;
    addedTitleRegenerationColumns.push("title_regeneration_started_at");
  }

  yield* sql`
    INSERT INTO t3_custom_schema_migrations (migration_id, name)
    VALUES (${CUSTOM_WORK_LANES_MIGRATION_ID}, ${LEGACY_WORK_LANES_MIGRATION_NAME})
    ON CONFLICT (migration_id) DO NOTHING
  `;

  const adoptedRows = yield* sql<{ readonly name: string }>`
    SELECT name
    FROM t3_custom_schema_migrations
    WHERE migration_id = ${CUSTOM_WORK_LANES_MIGRATION_ID}
    LIMIT 1
  `;
  const adoptedName = adoptedRows[0]?.name;
  if (adoptedName !== LEGACY_WORK_LANES_MIGRATION_NAME) {
    return yield* Effect.fail(
      new Error(
        `Custom migration namespace collision at id ${CUSTOM_WORK_LANES_MIGRATION_ID}: expected ${LEGACY_WORK_LANES_MIGRATION_NAME}, found ${adoptedName ?? "missing"}`,
      ),
    );
  }

  return {
    legacyWorkLanesMigrationDetected: true,
    addedTitleRegenerationColumns,
    adoptedLegacyWorkLanesMigration: true,
  } satisfies CustomMigrationCompatibilityResult;
});
