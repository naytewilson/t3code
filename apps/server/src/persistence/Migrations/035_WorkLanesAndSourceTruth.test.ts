// @effect-diagnostics preferSchemaOverJson:off
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const emptyLayer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));
const importLayer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

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
    }),
  );
});

importLayer("035_WorkLanesAndSourceTruth import", (it) => {
  it.effect(
    "imports idle→queued, active→recovery-required, archived→queued; never completed; idempotent",
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
          readonly objective_summary: string;
          readonly completed_at: string | null;
          readonly lane_json: string;
        }>`
          SELECT id, state, objective_summary, completed_at, lane_json
          FROM projection_work_lanes
          ORDER BY id ASC
        `;
        assert.strictEqual(lanes.length, 3);

        const idle = lanes.find((row) => row.id === "lane:import:thread-idle");
        assert.ok(idle);
        assert.strictEqual(idle.state, "queued");
        assert.strictEqual(idle.objective_summary, "Please fix the bug");
        assert.strictEqual(idle.completed_at, null);
        const idleLane = JSON.parse(idle.lane_json) as {
          readonly taskContract: { readonly objectiveDerivation: string };
          readonly completedAt: string | null;
        };
        assert.strictEqual(idleLane.taskContract.objectiveDerivation, "UNKNOWN");
        assert.strictEqual(idleLane.completedAt, null);

        const running = lanes.find((row) => row.id === "lane:import:thread-running");
        assert.ok(running);
        assert.strictEqual(running.state, "recovery-required");
        assert.strictEqual(running.completed_at, null);
        const runningLane = JSON.parse(running.lane_json) as {
          readonly legacyExecutorRef: { readonly sessionStatus: string } | null;
          readonly completedAt: string | null;
        };
        assert.strictEqual(runningLane.legacyExecutorRef?.sessionStatus, "running");
        assert.strictEqual(runningLane.completedAt, null);

        const archived = lanes.find((row) => row.id === "lane:import:thread-archived");
        assert.ok(archived);
        assert.strictEqual(archived.state, "queued");
        assert.strictEqual(archived.completed_at, null);
        assert.strictEqual(archived.objective_summary, "Archived thread");

        const events = yield* sql<{
          readonly event_id: string;
          readonly command_id: string | null;
        }>`
          SELECT event_id, command_id
          FROM orchestration_events
          WHERE event_type = 'lane.imported'
          ORDER BY event_id ASC
        `;
        assert.strictEqual(events.length, 3);
        assert.ok(events.every((event) => event.command_id === null));

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
        assert.strictEqual(lanesAfter.length, 3);
        assert.strictEqual(eventsAfter.length, 3);

        const completedCount = yield* sql<{ readonly count: number }>`
          SELECT COUNT(*) AS count
          FROM projection_work_lanes
          WHERE state = 'completed' OR completed_at IS NOT NULL
        `;
        assert.strictEqual(completedCount[0]?.count, 0);
      }),
  );
});
