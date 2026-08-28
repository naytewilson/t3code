import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import {
  CUSTOM_WORK_LANES_MIGRATION_ID,
  LEGACY_WORK_LANES_MIGRATION_NAME,
  runCustomMigrationCompatibilityBridge,
} from "./CustomMigrationCompatibility.ts";
import { runMigrations } from "./Migrations.ts";
import * as NodeSqliteClient from "./NodeSqliteClient.ts";

const createLegacyPrivateTables = (sql: SqlClient.SqlClient) =>
  Effect.gen(function* () {
    yield* sql`CREATE TABLE projection_work_lanes (id TEXT PRIMARY KEY)`;
    yield* sql`CREATE TABLE projection_source_truth_revisions (id TEXT PRIMARY KEY)`;
    yield* sql`CREATE TABLE projection_lane_acceptance_criteria (id TEXT PRIMARY KEY)`;
  });

const seedLegacyMigration35 = (sql: SqlClient.SqlClient) =>
  sql`
    INSERT INTO effect_sql_migrations (migration_id, name)
    VALUES (35, ${LEGACY_WORK_LANES_MIGRATION_NAME})
  `;

const assertIntegrity = Effect.fn("customMigrationCompatibility.assertIntegrity")(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ readonly integrity_check: string }>`PRAGMA integrity_check`;
  assert.equal(rows[0]?.integrity_check, "ok");
});

const freshOfficialLayer = it.layer(NodeSqliteClient.layerMemory());
freshOfficialLayer("custom migration compatibility: fresh official database", (it) => {
  it.effect("preserves the official migration-35 path", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations();

      const migration35 = yield* sql<{ readonly name: string }>`
        SELECT name FROM effect_sql_migrations WHERE migration_id = 35
      `;
      assert.equal(migration35[0]?.name, "ProjectionThreadTitleRegeneration");

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      const names = new Set(columns.map((column) => column.name));
      assert.ok(names.has("title_regeneration_request_id"));
      assert.ok(names.has("title_regeneration_started_at"));

      const customRows = yield* sql<{ readonly count: number }>`
        SELECT COUNT(*) AS count FROM t3_custom_schema_migrations
      `;
      assert.equal(customRows[0]?.count, 0);
      yield* assertIntegrity();
    }),
  );
});

const legacyCustomLayer = it.layer(NodeSqliteClient.layerMemory());
legacyCustomLayer("custom migration compatibility: legacy custom database", (it) => {
  it.effect("keeps historical row 35, repairs upstream 35, and continues through 43", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 34 });
      yield* createLegacyPrivateTables(sql);
      yield* seedLegacyMigration35(sql);

      yield* runMigrations();

      const migration35 = yield* sql<{ readonly name: string }>`
        SELECT name FROM effect_sql_migrations WHERE migration_id = 35
      `;
      assert.equal(migration35[0]?.name, LEGACY_WORK_LANES_MIGRATION_NAME);

      const latestMigration = yield* sql<{ readonly migration_id: number; readonly name: string }>`
        SELECT migration_id, name
        FROM effect_sql_migrations
        ORDER BY migration_id DESC
        LIMIT 1
      `;
      assert.equal(latestMigration[0]?.migration_id, 43);
      assert.equal(latestMigration[0]?.name, "ProjectionThreadsUnsettledAt");

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      const names = new Set(columns.map((column) => column.name));
      assert.ok(names.has("title_regeneration_request_id"));
      assert.ok(names.has("title_regeneration_started_at"));

      const adopted = yield* sql<{ readonly name: string }>`
        SELECT name
        FROM t3_custom_schema_migrations
        WHERE migration_id = ${CUSTOM_WORK_LANES_MIGRATION_ID}
      `;
      assert.equal(adopted[0]?.name, LEGACY_WORK_LANES_MIGRATION_NAME);
      yield* assertIntegrity();
    }),
  );
});

const alreadyBridgedLayer = it.layer(NodeSqliteClient.layerMemory());
alreadyBridgedLayer("custom migration compatibility: already bridged database", (it) => {
  it.effect("is idempotent", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 34 });
      yield* createLegacyPrivateTables(sql);
      yield* seedLegacyMigration35(sql);

      const first = yield* runCustomMigrationCompatibilityBridge();
      const second = yield* runCustomMigrationCompatibilityBridge();

      assert.deepEqual(first.addedTitleRegenerationColumns, [
        "title_regeneration_request_id",
        "title_regeneration_started_at",
      ]);
      assert.deepEqual(second.addedTitleRegenerationColumns, []);
      assert.equal(second.legacyWorkLanesMigrationDetected, true);
      assert.equal(second.adoptedLegacyWorkLanesMigration, true);

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      assert.equal(
        columns.filter((column) => column.name === "title_regeneration_request_id").length,
        1,
      );
      assert.equal(
        columns.filter((column) => column.name === "title_regeneration_started_at").length,
        1,
      );

      const customRows = yield* sql<{ readonly count: number }>`
        SELECT COUNT(*) AS count
        FROM t3_custom_schema_migrations
        WHERE migration_id = ${CUSTOM_WORK_LANES_MIGRATION_ID}
      `;
      assert.equal(customRows[0]?.count, 1);
      yield* assertIntegrity();
    }),
  );
});

const malformedLegacyLayer = it.layer(NodeSqliteClient.layerMemory());
malformedLegacyLayer("custom migration compatibility: malformed legacy database", (it) => {
  it.effect("fails closed when the historical ledger row exists without its private tables", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 34 });
      yield* seedLegacyMigration35(sql);

      const error = yield* runCustomMigrationCompatibilityBridge().pipe(Effect.flip);
      assert.match(String(error), /required private tables are missing/i);
    }),
  );
});
