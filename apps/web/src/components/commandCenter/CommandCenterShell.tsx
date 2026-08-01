import {
  createMockCommandCenterAdapter,
  getCommandCenterAdapter,
  setCommandCenterAdapter,
  type CommandCenterAdapter,
  type CommandCenterSnapshot,
  type LaneWorkspaceView,
} from "@t3tools/client-runtime/commandCenter";
import { EnvironmentId, WorkLaneId } from "@t3tools/contracts";
import { useEffect, useState } from "react";

import { LaneWorkspace } from "./LaneWorkspace";
import { ProjectsHome } from "./ProjectsHome";

export type CommandCenterView =
  | { readonly kind: "home" }
  | {
      readonly kind: "lane";
      readonly deepLink: string;
      readonly environmentId: EnvironmentId;
      readonly laneId: WorkLaneId;
    };

export function parseLaneDeepLink(
  deepLink: string,
): { environmentId: EnvironmentId; laneId: WorkLaneId } | null {
  const match = /^\/lanes\/([^/]+)\/([^/]+)\/?$/.exec(deepLink);
  if (match === null) return null;
  return {
    environmentId: EnvironmentId.make(match[1]!),
    laneId: WorkLaneId.make(match[2]!),
  };
}

/**
 * Self-contained F5/F6 shell. Not mounted from app navigation root yet —
 * Integrator must wire route registration. Defaults to the mock adapter so
 * the surface is inspectable before live projections land.
 */
export function CommandCenterShell({
  adapter,
  initialView = { kind: "home" },
}: {
  readonly adapter?: CommandCenterAdapter;
  readonly initialView?: CommandCenterView;
}) {
  const [view, setView] = useState<CommandCenterView>(initialView);
  const [snapshot, setSnapshot] = useState<CommandCenterSnapshot | null>(null);
  const [workspace, setWorkspace] = useState<LaneWorkspaceView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolved = adapter ?? createMockCommandCenterAdapter();
    setCommandCenterAdapter(resolved);
    return () => {
      // Leave adapter in place if an outer host configured a live one later.
    };
  }, [adapter]);

  useEffect(() => {
    let cancelled = false;
    const active = adapter ?? getCommandCenterAdapterSafe();
    if (active === null) return;
    void active
      .getSnapshot()
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  useEffect(() => {
    if (view.kind !== "lane") {
      setWorkspace(null);
      return;
    }
    let cancelled = false;
    const active = adapter ?? getCommandCenterAdapterSafe();
    if (active === null) return;
    void active
      .getLaneWorkspace(view.environmentId, view.laneId)
      .then((next) => {
        if (!cancelled) setWorkspace(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, view]);

  if (error) {
    return (
      <div data-testid="command-center-error" className="px-4 py-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (view.kind === "lane") {
    if (workspace === null) {
      return (
        <div
          data-testid="lane-workspace-loading"
          className="px-4 py-6 text-sm text-muted-foreground"
        >
          Loading lane…
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-2">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            data-testid="command-center-back-home"
            onClick={() => setView({ kind: "home" })}
          >
            ← Projects home
          </button>
        </div>
        <LaneWorkspace
          workspace={workspace}
          onControl={async (request) => {
            const active = adapter ?? getCommandCenterAdapter();
            const result = await active.dispatchAgentControl(request);
            const refreshed = await active.getLaneWorkspace(request.environmentId, request.laneId);
            setWorkspace(refreshed);
            return result;
          }}
          onOpenDeliverable={(deliverableId) => {
            const active = adapter ?? getCommandCenterAdapter();
            void active.openDeliverable(
              workspace.lane.environmentId,
              workspace.lane.id,
              deliverableId,
            );
          }}
        />
      </div>
    );
  }

  if (snapshot === null) {
    return (
      <div data-testid="projects-home-loading" className="px-4 py-6 text-sm text-muted-foreground">
        Loading projects…
      </div>
    );
  }

  return (
    <ProjectsHome
      snapshot={snapshot}
      onOpenDeepLink={(deepLink) => {
        const parsed = parseLaneDeepLink(deepLink);
        if (parsed === null) return;
        setView({ kind: "lane", deepLink, ...parsed });
      }}
    />
  );
}

function getCommandCenterAdapterSafe() {
  try {
    return getCommandCenterAdapter();
  } catch {
    const created = createMockCommandCenterAdapter();
    setCommandCenterAdapter(created);
    return created;
  }
}
