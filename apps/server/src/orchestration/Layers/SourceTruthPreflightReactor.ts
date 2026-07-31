import {
  CommandId,
  SourceTruthRevisionId,
  type OrchestrationProjectShell,
  type SourceTruthFileReference,
  type SourceTruthRevision,
  type WorkLane,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Crypto from "effect/Crypto";
import * as Encoding from "effect/Encoding";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

import * as GitVcsDriver from "../../vcs/GitVcsDriver.ts";
import type { OrchestrationDispatchError } from "../Errors.ts";
import { isWorkLaneWorktreeOwningState } from "../workLaneTransitions.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../Services/ProjectionSnapshotQuery.ts";
import {
  SourceTruthPreflightReactor,
  type SourceTruthPreflightReactorShape,
} from "../Services/SourceTruthPreflightReactor.ts";

const INSTRUCTION_NAMES = ["AGENTS.md", "CLAUDE.md", "COMMAND_CENTER.md"] as const;
const MANIFEST_PATHS = [
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "t3.json",
  "docs/macbrains/CAMPAIGN_MANIFEST.json",
] as const;
const RELEVANT_PATHS = [
  "packages/contracts/src/workLane.ts",
  "packages/contracts/src/sourceTruth.ts",
  "apps/server/src/orchestration/decider.ts",
  "apps/server/src/orchestration/projector.ts",
  "apps/server/src/orchestration/Layers/ProjectionPipeline.ts",
] as const;
const RELEVANT_TEST_PATHS = [
  "packages/contracts/src/workLane.test.ts",
  "apps/server/src/orchestration/decider.workLane.test.ts",
  "apps/server/src/orchestration/projector.workLane.test.ts",
  "apps/server/src/orchestration/Layers/ProjectionPipeline.test.ts",
] as const;

type GitTextResult = {
  readonly output: string | null;
  readonly failed: boolean;
};

const emptyGitTextResult: GitTextResult = { output: null, failed: true };

const trimOrNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeExternalSourceRef = (value: string): string =>
  value.replace(/(https?|ssh|git):\/\/[^/\s@]+@/giu, "$1://");

const makeReference = (path: string, role: SourceTruthFileReference["role"]): SourceTruthFileReference => ({
  path,
  role,
});

const canonicalPath = (path: Path.Path, value: string): string =>
  path.normalize(path.resolve(value));

const collectExistingReferences = Effect.fn("SourceTruth.collectExistingReferences")(function* ({
  fileSystem,
  path,
  candidates,
  role,
}: {
  readonly fileSystem: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly candidates: ReadonlyArray<string>;
  readonly role: SourceTruthFileReference["role"];
}) {
  const result: SourceTruthFileReference[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const absolute = canonicalPath(path, candidate);
    if (seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    if (yield* fileSystem.exists(absolute).pipe(Effect.orElseSucceed(() => false))) {
      result.push(makeReference(absolute, role));
    }
  }
  return result;
});

const readGitText = (
  git: GitVcsDriver.GitVcsDriver["Service"],
  cwd: string,
  args: ReadonlyArray<string>,
): Effect.Effect<GitTextResult, never> =>
  git
    .execute({
      operation: "SourceTruthPreflightReactor.git",
      cwd,
      args,
      allowNonZeroExit: true,
      timeoutMs: 10_000,
      maxOutputBytes: 2 * 1024 * 1024,
    })
    .pipe(
      Effect.map((result) => ({
        output: result.exitCode === 0 ? trimOrNull(result.stdout) : null,
        failed: result.exitCode !== 0,
      })),
      Effect.orElseSucceed(() => emptyGitTextResult),
    );

const detectGitOperation = Effect.fn("SourceTruthPreflightReactor.detectGitOperation")(function* ({
  fileSystem,
  path,
  git,
  cwd,
}: {
  readonly fileSystem: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly git: GitVcsDriver.GitVcsDriver["Service"];
  readonly cwd: string;
}) {
  const gitDirResult = yield* readGitText(git, cwd, ["rev-parse", "--git-dir"]);
  if (gitDirResult.output === null) {
    return "none" as const;
  }
  const gitDir = canonicalPath(path, path.resolve(cwd, gitDirResult.output));
  const markers = [
    ["merge", "MERGE_HEAD"],
    ["rebase", "rebase-merge"],
    ["rebase", "rebase-apply"],
    ["cherry-pick", "CHERRY_PICK_HEAD"],
    ["revert", "REVERT_HEAD"],
    ["bisect", "BISECT_LOG"],
  ] as const;
  for (const [operation, marker] of markers) {
    if (yield* fileSystem.exists(path.join(gitDir, marker)).pipe(Effect.orElseSucceed(() => false))) {
      return operation;
    }
  }
  return "none" as const;
});

const sourceTruthStatusFingerprint = Effect.fn(
  "SourceTruthPreflightReactor.sourceTruthStatusFingerprint",
)(function* (crypto: Crypto.Crypto, output: string | null) {
  if (output === null) {
    return null;
  }
  return yield* crypto
    .digest("SHA-256", new TextEncoder().encode(output))
    .pipe(Effect.map(Encoding.encodeHex), Effect.orElseSucceed(() => null));
});

const collectInstructionCandidates = (path: Path.Path, root: string): ReadonlyArray<string> => {
  const candidates: string[] = [];
  let current = canonicalPath(path, root);
  for (let depth = 0; depth < 8; depth += 1) {
    for (const name of INSTRUCTION_NAMES) {
      candidates.push(path.join(current, name));
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return candidates;
};

const parseBuildTestCandidates = (raw: string): ReadonlyArray<string> => {
  try {
    const parsed = JSON.parse(raw) as { readonly scripts?: unknown };
    if (typeof parsed.scripts !== "object" || parsed.scripts === null) {
      return [];
    }
    const scripts = parsed.scripts as Record<string, unknown>;
    return ["build", "typecheck", "test", "lint"].flatMap((name) => {
      const command = scripts[name];
      return typeof command === "string" ? [`${name}: ${command}`] : [];
    });
  } catch {
    return [];
  }
};

const collectBuildTestCandidates = Effect.fn(
  "SourceTruthPreflightReactor.collectBuildTestCandidates",
)(function* ({
  fileSystem,
  path,
  root,
}: {
  readonly fileSystem: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly root: string;
}) {
  const packagePath = path.join(root, "package.json");
  const packageJson = yield* fileSystem.readFileString(packagePath).pipe(Effect.option);
  if (Option.isNone(packageJson)) {
    return [] as ReadonlyArray<string>;
  }
  return parseBuildTestCandidates(packageJson.value);
});

const resolveOwnershipOverlap = Effect.fn("SourceTruthPreflightReactor.resolveOwnershipOverlap")(
  function* ({
    fileSystem,
    path,
    gitRoot,
    lane,
    lanes,
  }: {
    readonly fileSystem: FileSystem.FileSystem;
    readonly path: Path.Path;
    readonly gitRoot: string | null;
    readonly lane: WorkLane;
    readonly lanes: ReadonlyArray<WorkLane>;
  }) {
    if (lane.worktreePath === null) {
      return "not-applicable" as const;
    }
    const target = canonicalPath(path, lane.worktreePath);
    const targetExists = yield* fileSystem.exists(target).pipe(Effect.orElseSucceed(() => false));
    if (!targetExists) {
      return "unknown" as const;
    }
    for (const otherLane of lanes) {
      if (
        otherLane.id !== lane.id &&
        otherLane.worktreePath !== null &&
        isWorkLaneWorktreeOwningState(otherLane.state) &&
        canonicalPath(path, otherLane.worktreePath) === target
      ) {
        return "overlap" as const;
      }
    }
    if (gitRoot === null || canonicalPath(path, gitRoot) !== target) {
      return "unknown" as const;
    }
    return "exclusive" as const;
  },
);

const collectSourceTruth = Effect.fn("SourceTruthPreflightReactor.collectSourceTruth")(function* ({
  lane,
  project,
  lanes,
  git,
  fileSystem,
  path,
  crypto,
}: {
  readonly lane: WorkLane;
  readonly project: OrchestrationProjectShell;
  readonly lanes: ReadonlyArray<WorkLane>;
  readonly git: GitVcsDriver.GitVcsDriver["Service"];
  readonly fileSystem: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly crypto: Crypto.Crypto;
}): Effect.fn.Return<SourceTruthRevision, PlatformError.PlatformError> {
  const cwd = lane.worktreePath ?? project.workspaceRoot;
  const [rootResult, branchResult, headResult, baseResult, statusResult, remotesResult] =
    yield* Effect.all([
      readGitText(git, cwd, ["rev-parse", "--show-toplevel"]),
      readGitText(git, cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
      readGitText(git, cwd, ["rev-parse", "--verify", "HEAD^{commit}"]),
      readGitText(git, cwd, [
        "rev-parse",
        "--verify",
        `${lane.baseRef?.name ?? "origin/HEAD"}^{commit}`,
      ]),
      readGitText(git, cwd, ["status", "--porcelain=v2", "--branch", "--untracked-files=all"]),
      readGitText(git, cwd, ["remote", "-v"]),
    ]);
  const repositoryRoot =
    rootResult.output === null
      ? null
      : canonicalPath(path, path.resolve(cwd, rootResult.output));
  const statusOutput = statusResult.output;
  const dirtyLines =
    statusOutput === null
      ? []
      : statusOutput.split(/\r?\n/g).filter((line) => line.length > 0 && !line.startsWith("#"));
  const dirtyFingerprint = yield* sourceTruthStatusFingerprint(crypto, statusOutput);
  const activeGitOperation = yield* detectGitOperation({ fileSystem, path, git, cwd });
  const ownershipOverlap = yield* resolveOwnershipOverlap({
    fileSystem,
    path,
    gitRoot: repositoryRoot,
    lane,
    lanes,
  });
  const instructionFiles = yield* collectExistingReferences({
    fileSystem,
    path,
    candidates: collectInstructionCandidates(path, repositoryRoot ?? project.workspaceRoot),
    role: "instruction",
  });
  const manifests = yield* collectExistingReferences({
    fileSystem,
    path,
    candidates: MANIFEST_PATHS.map((candidate) => path.join(repositoryRoot ?? project.workspaceRoot, candidate)),
    role: "manifest",
  });
  const relevantFiles = yield* collectExistingReferences({
    fileSystem,
    path,
    candidates: RELEVANT_PATHS.map((candidate) => path.join(repositoryRoot ?? project.workspaceRoot, candidate)),
    role: "relevant",
  });
  const relevantTests = yield* collectExistingReferences({
    fileSystem,
    path,
    candidates: RELEVANT_TEST_PATHS.map((candidate) => path.join(repositoryRoot ?? project.workspaceRoot, candidate)),
    role: "test",
  });
  const unknownsThatChangeAction: string[] = [];
  if (rootResult.failed || repositoryRoot === null) unknownsThatChangeAction.push("repository root unavailable");
  if (statusResult.failed || statusOutput === null) unknownsThatChangeAction.push("Git status unavailable");
  if (headResult.failed || headResult.output === null) unknownsThatChangeAction.push("HEAD unavailable");
  if (baseResult.failed || baseResult.output === null) {
    unknownsThatChangeAction.push("base revision unavailable");
  }
  if (remotesResult.failed) {
    unknownsThatChangeAction.push("external source refs unavailable");
  }
  if (branchResult.output === null && headResult.output !== null) unknownsThatChangeAction.push("detached HEAD");
  if (lane.worktreePath !== null && ownershipOverlap === "unknown") {
    unknownsThatChangeAction.push("worktree ownership or repository identity is unresolved");
  }
  if (activeGitOperation !== "none") {
    unknownsThatChangeAction.push(`active Git operation: ${activeGitOperation}`);
  }
  const producedAt = DateTime.formatIso(yield* DateTime.now);
  const revisionId = SourceTruthRevisionId.make(
    `source-truth:${lane.id}:${yield* crypto.randomUUIDv4}`,
  );
  return {
    id: revisionId,
    laneId: lane.id,
    repositoryIdentity: lane.repositoryIdentity,
    repositoryRoot,
    branch: branchResult.output,
    detached: branchResult.output === null && headResult.output !== null,
    headSha: headResult.output,
    baseSha: baseResult.output,
    worktreePath: lane.worktreePath,
    dirty: {
      fingerprint: dirtyFingerprint,
      summary:
        statusOutput === null
          ? null
          : dirtyLines.length === 0
            ? "clean"
            : `${dirtyLines.length} changed path(s)`,
      isDirty: dirtyLines.length > 0,
    },
    instructionFiles,
    manifests,
    buildTestCandidates: yield* collectBuildTestCandidates({
      fileSystem,
      path,
      root: repositoryRoot ?? project.workspaceRoot,
    }),
    relevantFiles,
    relevantTests,
    activeGitOperation,
    ownershipOverlap,
    canonicalExternalSourceRefs:
      remotesResult.output === null
        ? []
        : remotesResult.output
            .split(/\r?\n/g)
            .filter((line) => line.length > 0)
            .map(sanitizeExternalSourceRef),
    unknownsThatChangeAction,
    safeNextAction:
      unknownsThatChangeAction.length === 0
        ? "continue workflow"
        : "resolve source-truth blockers before execution",
    producedAt,
    producerAssignmentId: null,
    producerThreadId: lane.primaryThreadId,
    environmentId: lane.environmentId,
    rawOutputArtifactRef: null,
    supersededAt: null,
    supersedesRevisionId: null,
  };
});

const makeGeneratedBranch = (lane: WorkLane): string =>
  `macbrains/${lane.id.replace(/[^a-zA-Z0-9._/-]/g, "-")}`;

export const makeSourceTruthPreflightReactor = Effect.gen(function* () {
  const engine = yield* OrchestrationEngineService;
  const snapshotQuery = yield* ProjectionSnapshotQuery;
  const git = yield* GitVcsDriver.GitVcsDriver;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;

  const dispatchConflict = (laneId: WorkLane["id"], summary: string, recordedAt: string) =>
    engine
      .dispatch({
        type: "source-truth.conflict.record",
        commandId: CommandId.make(`source-truth-conflict:${laneId}:${recordedAt}`),
        laneId,
        summary,
        recordedAt,
      })
      .pipe(Effect.asVoid, Effect.catch(() => Effect.void));

  const provisionWorktree = Effect.fn("SourceTruthPreflightReactor.provisionWorktree")(function* (
    lane: WorkLane,
    project: OrchestrationProjectShell,
    now: string,
  ): Effect.fn.Return<WorkLane | null, OrchestrationDispatchError> {
    const identityToAttach =
      lane.repositoryIdentity === null &&
      project.repositoryIdentity !== undefined
        ? (project.repositoryIdentity ?? null)
        : null;
    if (lane.classification !== "substantial" || lane.worktreePath !== null) {
      if (identityToAttach === null) {
        return lane;
      }
      yield* engine.dispatch({
        type: "lane.meta.update",
        commandId: CommandId.make(`source-truth-repository:${lane.id}:${now}`),
        laneId: lane.id,
        repositoryIdentity: identityToAttach,
        updatedAt: now,
      });
      return { ...lane, repositoryIdentity: identityToAttach };
    }
    const generatedBranch = makeGeneratedBranch(lane);
    const worktree = yield* git
      .createWorktree({
        cwd: project.workspaceRoot,
        refName: lane.branch ?? lane.baseRef?.name ?? "HEAD",
        ...(lane.branch === null
          ? {
              newRefName: generatedBranch,
              ...(lane.baseRef?.name !== undefined ? { baseRefName: lane.baseRef.name } : {}),
            }
          : {}),
        path: null,
      })
      .pipe(
        Effect.map(Option.some),
        Effect.catch((error) =>
          dispatchConflict(
            lane.id,
            `Unable to provision isolated worktree: ${String(error)}`,
            now,
          ).pipe(Effect.as(Option.none())),
        ),
      );
    if (Option.isNone(worktree)) {
      return null;
    }
    yield* engine.dispatch({
      type: "lane.meta.update",
      commandId: CommandId.make(`source-truth-worktree:${lane.id}:${now}`),
      laneId: lane.id,
      ...(lane.branch === null ? { branch: worktree.value.worktree.refName } : {}),
      worktreePath: worktree.value.worktree.path,
      ...(identityToAttach !== null ? { repositoryIdentity: identityToAttach } : {}),
      updatedAt: now,
    });
    return {
      ...lane,
      ...(lane.branch === null ? { branch: worktree.value.worktree.refName } : {}),
      worktreePath: worktree.value.worktree.path,
      ...(identityToAttach !== null ? { repositoryIdentity: identityToAttach } : {}),
    };
  });

  const handleEvent = (event: import("@t3tools/contracts").OrchestrationEvent) =>
    Effect.gen(function* () {
      const laneId = event.aggregateId as WorkLane["id"];
      const detailOption = yield* snapshotQuery.getLaneDetail(laneId);
      if (Option.isNone(detailOption)) {
        return;
      }
      const lane = detailOption.value.detail.lane;
      const projectOption = yield* snapshotQuery.getProjectShellById(lane.projectId);
      if (Option.isNone(projectOption)) {
        yield* dispatchConflict(lane.id, "Project workspace disappeared during preflight.", event.occurredAt);
        return;
      }
      const preparedLane = yield* provisionWorktree(lane, projectOption.value, event.occurredAt);
      if (preparedLane === null) {
        return;
      }
      const commandReadModel = yield* snapshotQuery.getCommandReadModel();
      const revisions = yield* collectSourceTruth({
        lane: preparedLane,
        project: projectOption.value,
        lanes: commandReadModel.lanes,
        git: git,
        fileSystem,
        path,
        crypto,
      });
      yield* engine.dispatch({
        type: "source-truth.preflight.record",
        commandId: CommandId.make(`source-truth-record:${preparedLane.id}:${revisions.id}`),
        laneId: preparedLane.id,
        revision: revisions,
        recordedAt: revisions.producedAt,
      }).pipe(
        Effect.catch((error) =>
          dispatchConflict(preparedLane.id, `Source-truth receipt rejected: ${String(error)}`, revisions.producedAt),
        ),
      );
    }).pipe(
      Effect.catch((error) =>
        dispatchConflict(
          event.aggregateId as WorkLane["id"],
          `Source-truth preflight failed: ${String(error)}`,
          event.occurredAt,
        ).pipe(
          Effect.tap(() =>
            Effect.logWarning("source-truth preflight reactor failed", {
              eventType: event.type,
              aggregateId: event.aggregateId,
              error,
            }),
          ),
        ),
      ),
    );

  const orchestrationEvents = engine.streamDomainEvents;

  const start: SourceTruthPreflightReactorShape["start"] = Effect.fn(
    "SourceTruthPreflightReactor.start",
  )(function* (): Effect.fn.Return<void, never, Scope.Scope> {
    const stream = orchestrationEvents.pipe(
      Stream.filter(
        (event) =>
          (event.type === "lane.state-changed" && event.payload.toState === "preflight") ||
          event.type === "source-truth.refresh-requested",
      ),
      Stream.runForEach(handleEvent),
    );
    yield* Effect.forkScoped(stream);
  });

  return { start } satisfies SourceTruthPreflightReactorShape;
});

export const SourceTruthPreflightReactorLive = Layer.effect(
  SourceTruthPreflightReactor,
  makeSourceTruthPreflightReactor,
);
