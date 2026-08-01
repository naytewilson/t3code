import {
  isAgentControlAvailable,
  type AgentAssignmentShell,
  type AgentControlAction,
  type AgentControlRequest,
} from "@t3tools/client-runtime/commandCenter";

import { Button } from "../ui/button";
import { cn } from "~/lib/utils";

const CONTROL_ACTIONS: ReadonlyArray<{
  readonly action: AgentControlAction;
  readonly label: string;
}> = [
  { action: "steer", label: "Steer" },
  { action: "queue", label: "Queue" },
  { action: "pause", label: "Pause" },
  { action: "resume", label: "Resume" },
  { action: "stop", label: "Stop" },
  { action: "replace", label: "Replace" },
  { action: "review", label: "Review" },
  { action: "open-result", label: "Open result" },
];

export function AgentTreePanel({
  director,
  workers,
  onControl,
  busyAssignmentId,
  className,
}: {
  readonly director: AgentAssignmentShell | null;
  readonly workers: ReadonlyArray<AgentAssignmentShell>;
  readonly onControl?: (
    request: Omit<AgentControlRequest, "environmentId" | "laneId"> & {
      readonly assignment: AgentAssignmentShell;
    },
  ) => void;
  readonly busyAssignmentId?: string | null;
  readonly className?: string;
}) {
  const nodes = director === null ? workers : [director, ...workers];

  return (
    <div data-testid="agent-tree-panel" className={cn("flex flex-col gap-2", className)}>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Agent tree
      </h3>
      {nodes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          No assignments on this lane yet
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {nodes.map((assignment) => (
            <li key={assignment.id}>
              <AgentNode
                assignment={assignment}
                depth={assignment.parentAssignmentId === null ? 0 : 1}
                busy={busyAssignmentId === assignment.id}
                onControl={onControl}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgentNode({
  assignment,
  depth,
  busy,
  onControl,
}: {
  readonly assignment: AgentAssignmentShell;
  readonly depth: number;
  readonly busy: boolean;
  readonly onControl?: (
    request: Omit<AgentControlRequest, "environmentId" | "laneId"> & {
      readonly assignment: AgentAssignmentShell;
    },
  ) => void;
}) {
  return (
    <div
      data-testid={`agent-node-${assignment.id}`}
      data-role={assignment.role}
      data-status={assignment.status}
      className={cn(
        "rounded-lg border border-border bg-background px-3 py-2.5",
        depth > 0 && "ml-4 border-l-2 border-l-muted-foreground/30",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {assignment.role}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {assignment.status}
            </span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {assignment.providerInstanceId} / {assignment.resolvedModel} ·{" "}
            {assignment.reasoningLevel}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CONTROL_ACTIONS.map(({ action, label }) => {
          const enabled = isAgentControlAvailable(assignment.status, action);
          return (
            <Button
              key={action}
              type="button"
              size="xs"
              variant="outline"
              disabled={!enabled || busy}
              data-testid={`agent-control-${assignment.id}-${action}`}
              onClick={() =>
                onControl?.({
                  action,
                  assignmentId: assignment.id,
                  assignment,
                  instruction: action === "steer" ? "Continue with current plan" : undefined,
                })
              }
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
