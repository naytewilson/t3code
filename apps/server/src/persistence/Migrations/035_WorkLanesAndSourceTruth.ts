// @effect-diagnostics nodeBuiltinImport:off
// @effect-diagnostics preferSchemaOverJson:off
// @effect-diagnostics globalErrorInEffectFailure:off
// @effect-diagnostics globalDateInEffect:off
/**
 * Migration 035 — work-lane / source-truth projection tables + legacy thread import.
 *
 * Requires ServerConfig with a readable environmentIdPath so imported lanes stamp a
 * real environment id. Archived threads are skipped. After import, stamps
 * `projection.work-lanes` projection_state to MAX(orchestration_events.sequence).
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as fs from "node:fs";

import { ServerConfig } from "../../config.ts";

const ACTIVE_SESSION_STATUSES = new Set(["starting", "running", "ready", "interrupted", "error"]);

type ImportThreadRow = {
  readonly threadId: string;
  readonly projectId: string;
  readonly title: string;
  readonly branch: string | null;
  readonly worktreePath: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly workspaceRoot: string;
  readonly sessionStatus: string | null;
  readonly providerName: string | null;
  readonly providerSessionId: string | null;
  readonly earliestUserMessage: string | null;
};

const readEnvironmentIdFromPath = (environmentIdPath: string): string | null => {
  try {
    const raw = fs.readFileSync(environmentIdPath, "utf8").trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
};

const resolveEnvironmentId = Effect.gen(function* () {
  const configOption = yield* Effect.serviceOption(ServerConfig);
  if (Option.isNone(configOption)) {
    return yield* Effect.fail(
      new Error(
        "Migration 035_WorkLanesAndSourceTruth requires ServerConfig with a readable environmentIdPath",
      ),
    );
  }

  const environmentIdPath = configOption.value.environmentIdPath;
  const fileSystemOption = yield* Effect.serviceOption(FileSystem.FileSystem);
  if (Option.isSome(fileSystemOption)) {
    const exists = yield* fileSystemOption.value
      .exists(environmentIdPath)
      .pipe(Effect.orElseSucceed(() => false));
    if (!exists) {
      return yield* Effect.fail(
        new Error(
          `Migration 035_WorkLanesAndSourceTruth: environment id file missing at '${environmentIdPath}'`,
        ),
      );
    }
    const raw = yield* fileSystemOption.value.readFileString(environmentIdPath).pipe(
      Effect.map((value) => value.trim()),
      Effect.mapError(
        (cause) =>
          new Error(
            `Migration 035_WorkLanesAndSourceTruth: failed to read environment id at '${environmentIdPath}': ${String(cause)}`,
          ),
      ),
    );
    if (raw.length === 0) {
      return yield* Effect.fail(
        new Error(
          `Migration 035_WorkLanesAndSourceTruth: environment id file at '${environmentIdPath}' is empty`,
        ),
      );
    }
    return raw;
  }

  const fromDisk = readEnvironmentIdFromPath(environmentIdPath);
  if (fromDisk === null) {
    return yield* Effect.fail(
      new Error(
        `Migration 035_WorkLanesAndSourceTruth: environment id file missing or unreadable at '${environmentIdPath}'`,
      ),
    );
  }
  return fromDisk;
});

function importStateForSession(sessionStatus: string | null): "queued" | "recovery-required" {
  if (sessionStatus !== null && ACTIVE_SESSION_STATUSES.has(sessionStatus)) {
    return "recovery-required";
  }
  return "queued";
}

function buildImportedLanePayload(input: {
  readonly environmentId: string;
  readonly row: ImportThreadRow;
}) {
  const laneId = `lane:import:${input.row.threadId}`;
  const title = input.row.title.trim().length > 0 ? input.row.title.trim() : "Imported thread";
  const objectiveText =
    input.row.earliestUserMessage !== null && input.row.earliestUserMessage.trim().length > 0
      ? input.row.earliestUserMessage.trim()
      : title;
  const state = importStateForSession(input.row.sessionStatus);
  const legacyExecutorRef =
    input.row.sessionStatus === null
      ? null
      : {
          threadId: input.row.threadId,
          runtimeSessionId: input.row.providerSessionId,
          providerName: input.row.providerName,
          sessionStatus: input.row.sessionStatus,
        };

  const lane = {
    id: laneId,
    projectId: input.row.projectId,
    title,
    taskContract: {
      objective: objectiveText,
      constraints: [],
      nonGoals: [],
      deliverableRequirement: "none" as const,
      requiresPullRequest: false,
      requiresUserVisibleSurface: false,
      authorizedActions: [],
      prohibitedActions: [],
      completionReportRequired: true as const,
      objectiveDerivation: "UNKNOWN" as const,
    },
    state,
    priority: "normal" as const,
    classification: "substantial" as const,
    environmentId: input.environmentId,
    repositoryIdentity: null,
    baseRef: null,
    branch: input.row.branch,
    worktreePath: input.row.worktreePath,
    ownerAssignmentId: null,
    advisorAssignmentIds: [],
    verifierAssignmentIds: [],
    sourceTruthRevisionId: null,
    sourceTruthActiveGitOperation: "none" as const,
    sourceTruthOwnershipOverlap: "unknown" as const,
    activePlanRevisionId: null,
    supersedingLaneId: null,
    acceptanceCriterionIds: [],
    requiredReceiptKinds: [],
    deliverableIds: [],
    blockerIds: [],
    primaryThreadId: input.row.threadId,
    importedThreadId: input.row.threadId,
    threadIds: [input.row.threadId],
    legacyExecutorRef,
    resumeState: null,
    createdAt: input.row.createdAt,
    updatedAt: input.row.updatedAt,
    completedAt: null,
  };

  return {
    lane,
    acceptanceCriteria: [] as const,
    importedFromThreadId: input.row.threadId,
    importReason: "legacy-thread-migration",
  };
}

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const environmentId = yield* resolveEnvironmentId;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_work_lanes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      state TEXT NOT NULL,
      priority TEXT NOT NULL,
      classification TEXT NOT NULL,
      environment_id TEXT NOT NULL,
      branch TEXT,
      worktree_path TEXT,
      source_truth_revision_id TEXT,
      primary_thread_id TEXT,
      imported_thread_id TEXT,
      objective_summary TEXT NOT NULL,
      lane_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      last_sequence INTEGER NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_work_lanes_project_id
    ON projection_work_lanes(project_id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_work_lanes_updated_at
    ON projection_work_lanes(updated_at)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_source_truth_revisions (
      id TEXT PRIMARY KEY,
      lane_id TEXT NOT NULL,
      revision_json TEXT NOT NULL,
      produced_at TEXT NOT NULL,
      superseded_at TEXT,
      last_sequence INTEGER NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_source_truth_revisions_lane_id
    ON projection_source_truth_revisions(lane_id)
  `;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_lane_acceptance_criteria (
      id TEXT PRIMARY KEY,
      lane_id TEXT NOT NULL,
      criterion_json TEXT NOT NULL,
      last_sequence INTEGER NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_lane_acceptance_criteria_lane_id
    ON projection_lane_acceptance_criteria(lane_id)
  `;

  const threads = yield* sql<ImportThreadRow>`
    SELECT
      t.thread_id AS "threadId",
      t.project_id AS "projectId",
      t.title AS "title",
      t.branch AS "branch",
      t.worktree_path AS "worktreePath",
      t.created_at AS "createdAt",
      t.updated_at AS "updatedAt",
      p.workspace_root AS "workspaceRoot",
      s.status AS "sessionStatus",
      s.provider_name AS "providerName",
      s.provider_session_id AS "providerSessionId",
      (
        SELECT m.text
        FROM projection_thread_messages m
        WHERE m.thread_id = t.thread_id
          AND m.role = 'user'
        ORDER BY m.created_at ASC, m.message_id ASC
        LIMIT 1
      ) AS "earliestUserMessage"
    FROM projection_threads t
    INNER JOIN projection_projects p
      ON p.project_id = t.project_id
    LEFT JOIN projection_thread_sessions s
      ON s.thread_id = t.thread_id
    WHERE t.deleted_at IS NULL
      AND t.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM projection_work_lanes wl
        WHERE wl.id = 'lane:import:' || t.thread_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM orchestration_events e
        WHERE e.event_id = 'lane-import-event:' || t.thread_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM orchestration_events e
        WHERE e.aggregate_kind = 'lane'
          AND e.stream_id = 'lane:import:' || t.thread_id
          AND e.event_type IN ('lane.imported', 'lane.created')
      )
    ORDER BY t.created_at ASC, t.thread_id ASC
  `;

  for (const row of threads) {
    const payload = buildImportedLanePayload({ environmentId, row });
    const laneId = payload.lane.id;
    const eventId = `lane-import-event:${row.threadId}`;
    const payloadJson = JSON.stringify(payload);
    const laneJson = JSON.stringify(payload.lane);

    const inserted = yield* sql<{ readonly sequence: number }>`
      INSERT INTO orchestration_events (
        event_id,
        aggregate_kind,
        stream_id,
        stream_version,
        event_type,
        occurred_at,
        command_id,
        causation_event_id,
        correlation_id,
        actor_kind,
        payload_json,
        metadata_json
      )
      VALUES (
        ${eventId},
        'lane',
        ${laneId},
        COALESCE(
          (
            SELECT stream_version + 1
            FROM orchestration_events
            WHERE aggregate_kind = 'lane'
              AND stream_id = ${laneId}
            ORDER BY stream_version DESC
            LIMIT 1
          ),
          0
        ),
        'lane.imported',
        ${row.updatedAt},
        NULL,
        NULL,
        NULL,
        'server',
        ${payloadJson},
        '{}'
      )
      RETURNING sequence
    `;

    const sequence = inserted[0]?.sequence;
    if (sequence === undefined) {
      continue;
    }

    yield* sql`
      INSERT INTO projection_work_lanes (
        id,
        project_id,
        title,
        state,
        priority,
        classification,
        environment_id,
        branch,
        worktree_path,
        source_truth_revision_id,
        primary_thread_id,
        imported_thread_id,
        objective_summary,
        lane_json,
        created_at,
        updated_at,
        completed_at,
        last_sequence
      )
      VALUES (
        ${payload.lane.id},
        ${payload.lane.projectId},
        ${payload.lane.title},
        ${payload.lane.state},
        ${payload.lane.priority},
        ${payload.lane.classification},
        ${payload.lane.environmentId},
        ${payload.lane.branch},
        ${payload.lane.worktreePath},
        ${payload.lane.sourceTruthRevisionId},
        ${payload.lane.primaryThreadId},
        ${payload.lane.importedThreadId},
        ${payload.lane.taskContract.objective},
        ${laneJson},
        ${payload.lane.createdAt},
        ${payload.lane.updatedAt},
        ${payload.lane.completedAt},
        ${sequence}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  const maxSequenceRows = yield* sql<{ readonly maxSequence: number | null }>`
    SELECT MAX(sequence) AS "maxSequence"
    FROM orchestration_events
  `;
  const lastAppliedSequence = maxSequenceRows[0]?.maxSequence ?? 0;
  const stampedAt = new Date().toISOString();

  yield* sql`
    INSERT INTO projection_state (
      projector,
      last_applied_sequence,
      updated_at
    )
    VALUES (
      'projection.work-lanes',
      ${lastAppliedSequence},
      ${stampedAt}
    )
    ON CONFLICT (projector) DO UPDATE SET
      last_applied_sequence = excluded.last_applied_sequence,
      updated_at = excluded.updated_at
  `;
});
