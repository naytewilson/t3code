// @effect-diagnostics preferSchemaOverJson:off
// @effect-diagnostics nodeBuiltinImport:off
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { ServerConfig } from "../../config.ts";
import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const TEST_ENVIRONMENT_ID = "env-035-worklanes";
const environmentIdDir = fs.mkdtempSync(path.join(os.tmpdir(), "t3-035-env-"));
const environmentIdPath = path.join(environmentIdDir, "environment-id");
fs.writeFileSync(environmentIdPath, `${TEST_ENVIRONMENT_ID}\n`);

const serverConfigLayer = Layer.succeed(
  ServerConfig,
  ServerConfig.of({
    logLevel: "Error",
    traceMinLevel: "Info",
    traceTimingEnabled: true,
    traceBatchWindowMs: 200,
    traceMaxBytes: 10 * 1024 * 1024,
    traceMaxFiles: 10,
    otlpTracesUrl: undefined,
    otlpMetricsUrl: undefined,
    otlpExportIntervalMs: 10_000,
    otlpServiceName: "t3-server",
    cwd: process.cwd(),
    baseDir: environmentIdDir,
    stateDir: environmentIdDir,
    dbPath: path.join(environmentIdDir, "state.sqlite"),
    keybindingsConfigPath: path.join(environmentIdDir, "keybindings.json"),
    settingsPath: path.join(environmentIdDir, "settings.json"),
    providerStatusCacheDir: path.join(environmentIdDir, "caches"),
    worktreesDir: path.join(environmentIdDir, "worktrees"),
    attachmentsDir: path.join(environmentIdDir, "attachments"),
    logsDir: path.join(environmentIdDir, "logs"),
    serverLogPath: path.join(environmentIdDir, "logs", "server.log"),
    serverTracePath: path.join(environmentIdDir, "logs", "server.trace.ndjson"),
    providerLogsDir: path.join(environmentIdDir, "logs", "provider"),
    providerEventLogPath: path.join(environmentIdDir, "logs", "provider", "events.log"),
    terminalLogsDir: path.join(environmentIdDir, "logs", "terminals"),
    anonymousIdPath: path.join(environmentIdDir, "anonymous-id"),
    environmentIdPath,
    serverRuntimeStatePath: path.join(environmentIdDir, "server-runtime.json"),
    secretsDir: path.join(environmentIdDir, "secrets"),
    mode: "web",
    autoBootstrapProjectFromCwd: false,
    logWebSocketEvents: false,
    tailscaleServeEnabled: false,
    tailscaleServePort: 443,
    port: 0,
    host: undefined,
    desktopBootstrapToken: undefined,
    desktopTelemetryFd: undefined,
    desktopTelemetryControlFd: undefined,
    resourceMonitorPath: undefined,
    staticDir: undefined,
    devUrl: undefined,
    devAllowedOrigins: [],
    noBrowser: false,
    startupPresentation: "browser",
  }),
);

const emptyLayer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory(), serverConfigLayer));
const importLayer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory(), serverConfigLayer));

const insertProject = (sql: SqlClient.SqlClient, projectId: string) => sql`
  INSERT INTO projection_projects (
    project_id,
    title,
    workspace_root,
    default_model_selection_json,
    scripts_json,
    created_at,
    updated_at,
    deleted_at
  )
  VALUES (
    ${projectId},
    'Project',
    '/tmp/project',
    NULL,
    '[]',
    '2026-07-30T00:00:00.000Z',
    '2026-07-30T00:00:00.000Z',
    NULL
  )
`;

const insertThread = (
  sql: SqlClient.SqlClient,
  input: {
    readonly threadId: string;
    readonly projectId: string;
    readonly title: string;
    readonly archivedAt?: string | null;
  },
) => sql`
  INSERT INTO projection_threads (
    thread_id,
    project_id,
    title,
    model_selection_json,
    runtime_mode,
    interaction_mode,
    branch,
    worktree_path,
    latest_turn_id,
    created_at,
    updated_at,
    archived_at,
    settled_override,
    settled_at,
    snoozed_until,
    snoozed_at,
    latest_user_message_at,
    pending_approval_count,
    pending_user_input_count,
    has_actionable_proposed_plan,
    deleted_at
  )
  VALUES (
    ${input.threadId},
    ${input.projectId},
    ${input.title},
    '{"provider":"codex","model":"gpt-5.4"}',
    'full-access',
    'default',
    'feature/import',
    '/tmp/worktree',
    NULL,
    '2026-07-30T00:00:00.000Z',
    '2026-07-30T01:00:00.000Z',
    ${input.archivedAt ?? null},
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    0,
    0,
    0,
    NULL
  )
`;

const insertSession = (
  sql: SqlClient.SqlClient,
  input: {
    readonly threadId: string;
    readonly status: string;
  },
) => sql`
  INSERT INTO projection_thread_sessions (
    thread_id,
    status,
    provider_name,
    provider_session_id,
    provider_thread_id,
    active_turn_id,
    last_error,
    updated_at,
    runtime_mode,
    provider_instance_id
  )
  VALUES (
    ${input.threadId},
    ${input.status},
    'codex',
    'provider-session-1',
    'provider-thread-1',
    NULL,
    NULL,
    '2026-07-30T01:00:00.000Z',
    'full-access',
    NULL
  )
`;

const insertUserMessage = (
  sql: SqlClient.SqlClient,
  input: {
    readonly messageId: string;
    readonly threadId: string;
    readonly text: string;
    readonly createdAt: string;
  },
) => sql`
  INSERT INTO projection_thread_messages (
    message_id,
    thread_id,
    turn_id,
    role,
    text,
    attachments_json,
    is_streaming,
    created_at,
    updated_at
  )
  VALUES (
    ${input.messageId},
    ${input.threadId},
    NULL,
    'user',
    ${input.text},
    NULL,
    0,
    ${input.createdAt},
    ${input.createdAt}
  )
`;

const noServerConfigLayer = it.layer(NodeSqliteClient.layerMemory());

noServerConfigLayer("035_WorkLanesAndSourceTruth without ServerConfig", (it) => {
  it.effect("fails migration when ServerConfig environment id is unavailable", () =>
    Effect.gen(function* () {
      yield* runMigrations({ toMigrationInclusive: 34 });
      const migration = yield* Effect.promise(() => import("./035_WorkLanesAndSourceTruth.ts"));
      const error = yield* migration.default.pipe(Effect.flip);
      assert.match(String(error), /requires ServerConfig|environment id/i);
    }),
  );
});

emptyLayer("035_WorkLanesAndSourceTruth empty", (it) => {
  it.effect("creates empty projection tables when there are no threads", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 34 });
      yield* runMigrations({ toMigrationInclusive: 35 });

      const tables = yield* sql<{ readonly name: string }>`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN (
            'projection_work_lanes',
            'projection_source_truth_revisions',
            'projection_lane_acceptance_criteria'
          )
        ORDER BY name
      `;
      assert.deepStrictEqual(
        tables.map((row) => row.name),
        [
          "projection_lane_acceptance_criteria",
          "projection_source_truth_revisions",
          "projection_work_lanes",
        ],
      );

      const lanes = yield* sql`SELECT id FROM projection_work_lanes`;
      assert.strictEqual(lanes.length, 0);

      const events = yield* sql`
        SELECT event_id
        FROM orchestration_events
        WHERE event_type = 'lane.imported'
      `;
      assert.strictEqual(events.length, 0);

      const projectionState = yield* sql<{
        readonly projector: string;
        readonly last_applied_sequence: number;
      }>`
        SELECT projector, last_applied_sequence
        FROM projection_state
        WHERE projector = 'projection.work-lanes'
      `;
      assert.strictEqual(projectionState.length, 1);
      assert.strictEqual(projectionState[0]?.last_applied_sequence, 0);
    }),
  );
});

importLayer("035_WorkLanesAndSourceTruth import", (it) => {
  it.effect(
    "imports idle→queued, active→recovery-required; skips archived; stamps env + projection_state; never completed; idempotent",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* runMigrations({ toMigrationInclusive: 34 });

        yield* insertProject(sql, "project-1");
        yield* insertThread(sql, {
          threadId: "thread-idle",
          projectId: "project-1",
          title: "Idle thread",
        });
        yield* insertSession(sql, { threadId: "thread-idle", status: "idle" });
        yield* insertUserMessage(sql, {
          messageId: "msg-1",
          threadId: "thread-idle",
          text: "Please fix the bug",
          createdAt: "2026-07-30T00:30:00.000Z",
        });
        yield* insertUserMessage(sql, {
          messageId: "msg-2",
          threadId: "thread-idle",
          text: "Later message",
          createdAt: "2026-07-30T00:45:00.000Z",
        });

        yield* insertThread(sql, {
          threadId: "thread-running",
          projectId: "project-1",
          title: "Running thread",
        });
        yield* insertSession(sql, { threadId: "thread-running", status: "running" });

        yield* insertThread(sql, {
          threadId: "thread-archived",
          projectId: "project-1",
          title: "Archived thread",
          archivedAt: "2026-07-29T00:00:00.000Z",
        });

        yield* runMigrations({ toMigrationInclusive: 35 });

        const lanes = yield* sql<{
          readonly id: string;
          readonly state: string;
          readonly environment_id: string;
          readonly objective_summary: string;
          readonly completed_at: string | null;
          readonly lane_json: string;
        }>`
          SELECT id, state, environment_id, objective_summary, completed_at, lane_json
          FROM projection_work_lanes
          ORDER BY id ASC
        `;
        assert.strictEqual(lanes.length, 2);

        const idle = lanes.find((row) => row.id === "lane:import:thread-idle");
        assert.ok(idle);
        assert.strictEqual(idle.state, "queued");
        assert.strictEqual(idle.environment_id, TEST_ENVIRONMENT_ID);
        assert.strictEqual(idle.objective_summary, "Please fix the bug");
        assert.strictEqual(idle.completed_at, null);
        const idleLane = JSON.parse(idle.lane_json) as {
          readonly environmentId: string;
          readonly taskContract: { readonly objectiveDerivation: string };
          readonly sourceTruthActiveGitOperation: string;
          readonly sourceTruthOwnershipOverlap: string;
          readonly supersedingLaneId: string | null;
          readonly completedAt: string | null;
        };
        assert.strictEqual(idleLane.environmentId, TEST_ENVIRONMENT_ID);
        assert.strictEqual(idleLane.taskContract.objectiveDerivation, "UNKNOWN");
        assert.strictEqual(idleLane.sourceTruthActiveGitOperation, "none");
        assert.strictEqual(idleLane.sourceTruthOwnershipOverlap, "unknown");
        assert.strictEqual(idleLane.supersedingLaneId, null);
        assert.strictEqual(idleLane.completedAt, null);

        const running = lanes.find((row) => row.id === "lane:import:thread-running");
        assert.ok(running);
        assert.strictEqual(running.state, "recovery-required");
        assert.strictEqual(running.environment_id, TEST_ENVIRONMENT_ID);
        assert.strictEqual(running.completed_at, null);
        const runningLane = JSON.parse(running.lane_json) as {
          readonly legacyExecutorRef: { readonly sessionStatus: string } | null;
          readonly completedAt: string | null;
        };
        assert.strictEqual(runningLane.legacyExecutorRef?.sessionStatus, "running");
        assert.strictEqual(runningLane.completedAt, null);

        assert.strictEqual(
          lanes.find((row) => row.id === "lane:import:thread-archived"),
          undefined,
        );

        const events = yield* sql<{
          readonly event_id: string;
          readonly command_id: string | null;
        }>`
          SELECT event_id, command_id
          FROM orchestration_events
          WHERE event_type = 'lane.imported'
          ORDER BY event_id ASC
        `;
        assert.strictEqual(events.length, 2);
        assert.ok(events.every((event) => event.command_id === null));

        const maxSequence = yield* sql<{ readonly maxSequence: number | null }>`
          SELECT MAX(sequence) AS "maxSequence"
          FROM orchestration_events
        `;
        const projectionState = yield* sql<{
          readonly projector: string;
          readonly last_applied_sequence: number;
        }>`
          SELECT projector, last_applied_sequence
          FROM projection_state
          WHERE projector = 'projection.work-lanes'
        `;
        assert.strictEqual(projectionState.length, 1);
        assert.strictEqual(
          projectionState[0]?.last_applied_sequence,
          maxSequence[0]?.maxSequence ?? 0,
        );

        const migration = yield* Effect.promise(
          () => import("./035_WorkLanesAndSourceTruth.ts"),
        );
        yield* migration.default;

        const lanesAfter = yield* sql`SELECT id FROM projection_work_lanes`;
        const eventsAfter = yield* sql`
          SELECT event_id
          FROM orchestration_events
          WHERE event_type = 'lane.imported'
        `;
        assert.strictEqual(lanesAfter.length, 2);
        assert.strictEqual(eventsAfter.length, 2);

        const completedCount = yield* sql<{ readonly count: number }>`
          SELECT COUNT(*) AS count
          FROM projection_work_lanes
          WHERE state = 'completed' OR completed_at IS NOT NULL
        `;
        assert.strictEqual(completedCount[0]?.count, 0);
      }),
  );
});
