import type {
  AgentControlRequest,
  AgentControlResult,
  LaneWorkspaceView,
} from "@t3tools/client-runtime/commandCenter";
import { useState, type ReactNode } from "react";

import { AgentTreePanel } from "./AgentTreePanel";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";

export function LaneWorkspace({
  workspace,
  onControl,
  onOpenDeliverable,
  className,
}: {
  readonly workspace: LaneWorkspaceView;
  readonly onControl?: (request: AgentControlRequest) => Promise<AgentControlResult>;
  readonly onOpenDeliverable?: (deliverableId: string) => void;
  readonly className?: string;
}) {
  const [busyAssignmentId, setBusyAssignmentId] = useState<string | null>(null);
  const [lastControlMessage, setLastControlMessage] = useState<string | null>(null);

  return (
    <div
      data-testid="lane-workspace"
      data-lane-id={workspace.lane.id}
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-6",
        className,
      )}
    >
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">{workspace.lane.title}</h1>
          <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {workspace.lane.state}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{workspace.project.title}</p>
      </header>

      <Panel title="Task">
        <p className="text-sm text-foreground">{workspace.taskObjective}</p>
      </Panel>

      <Panel title="Source truth">
        <MetaRow label="Revision" value={workspace.sourceTruthRevisionId ?? "none"} />
        <MetaRow label="Summary" value={workspace.sourceTruthSummary ?? "No summary"} />
        <MetaRow label="Branch" value={workspace.branch ?? "detached / unknown"} />
      </Panel>

      <Panel title="Plan">
        <MetaRow label="Revision" value={workspace.planRevisionId ?? "none"} />
        <MetaRow label="Summary" value={workspace.planSummary ?? "No active plan"} />
      </Panel>

      <Panel title="Director">
        {workspace.director === null ? (
          <p className="text-sm text-muted-foreground">No director assignment</p>
        ) : (
          <MetaRow
            label={workspace.director.role}
            value={`${workspace.director.providerInstanceId} / ${workspace.director.resolvedModel} · ${workspace.director.status}`}
          />
        )}
      </Panel>

      <AgentTreePanel
        director={workspace.director}
        workers={workspace.workers}
        busyAssignmentId={busyAssignmentId}
        onControl={(request) => {
          if (!onControl) return;
          setBusyAssignmentId(request.assignmentId);
          void onControl({
            action: request.action,
            assignmentId: request.assignmentId,
            laneId: workspace.lane.id,
            environmentId: workspace.lane.environmentId,
            instruction: request.instruction,
          })
            .then((result) => {
              setLastControlMessage(result.message);
            })
            .finally(() => {
              setBusyAssignmentId(null);
            });
        }}
      />

      {lastControlMessage ? (
        <p data-testid="lane-control-message" className="text-xs text-muted-foreground">
          {lastControlMessage}
        </p>
      ) : null}

      <Panel title="Worktree">
        <MetaRow label="Path" value={workspace.worktreePath ?? "none"} />
        <MetaRow label="Branch" value={workspace.branch ?? "none"} />
      </Panel>

      <Panel title="Changed files">
        {workspace.changedFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changed files</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {workspace.changedFiles.map((file) => (
              <li
                key={file.path}
                data-testid={`changed-file-${file.path}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate font-mono text-xs text-foreground">{file.path}</span>
                <span className="text-[11px] text-muted-foreground">{file.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Checks">
        <ul className="flex flex-col gap-1">
          {workspace.checks.map((check) => (
            <li
              key={check.id}
              data-testid={`lane-check-${check.id}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-foreground">
                {check.title}
                {check.required ? (
                  <span className="ml-1 text-[11px] text-muted-foreground">required</span>
                ) : null}
              </span>
              <span className="text-[11px] text-muted-foreground">{check.status}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Review">
        <MetaRow label="Status" value={workspace.reviewStatus} />
      </Panel>

      <Panel title="Deliverable">
        {workspace.deliverables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliverables registered</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {workspace.deliverables.map((deliverable) => (
              <li
                key={deliverable.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">{deliverable.title}</div>
                  <div className="text-[11px] text-muted-foreground">{deliverable.status}</div>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  data-testid={`open-deliverable-${deliverable.id}`}
                  disabled={deliverable.status !== "ready" && deliverable.status !== "accepted"}
                  onClick={() => onOpenDeliverable?.(deliverable.id)}
                >
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="rounded-lg border border-border px-3 py-2.5">{children}</div>
    </section>
  );
}

function MetaRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-1 text-sm sm:flex-row sm:items-baseline sm:gap-3">
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-all text-foreground">{value}</span>
    </div>
  );
}
