import type { CommandCenterCard, NodeActivityShell } from "@t3tools/client-runtime/commandCenter";

import { cn } from "~/lib/utils";

export function ProjectCard({
  card,
  onOpen,
}: {
  readonly card: CommandCenterCard;
  readonly onOpen?: (deepLink: string) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`command-center-card-${card.lane.id}`}
      data-section={card.section}
      data-deep-link={card.deepLink}
      onClick={() => onOpen?.(card.deepLink)}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-left",
        "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{card.project.title}</div>
          <div className="truncate text-xs text-muted-foreground">{card.lane.title}</div>
        </div>
        <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {card.lane.state}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{card.environmentId}</span>
        {card.primaryRole ? <span>{card.primaryRole}</span> : null}
        {card.providerModelSummary ? <span>{card.providerModelSummary}</span> : null}
        {card.lane.branch ? <span>{card.lane.branch}</span> : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground/90">{card.nextAction}</span>
        {card.attentionReason ? (
          <span className="text-destructive">{card.attentionReason}</span>
        ) : card.lastReceiptKind ? (
          <span className="text-muted-foreground">last: {card.lastReceiptKind}</span>
        ) : null}
      </div>
    </button>
  );
}

export function NodeActivityCard({
  item,
  onOpen,
}: {
  readonly item: NodeActivityShell;
  readonly onOpen?: (laneId: string) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`node-activity-card-${item.id}`}
      data-section="node-activity"
      onClick={() => onOpen?.(item.laneId)}
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg border border-border bg-background px-3 py-2.5 text-left",
        "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
        <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {item.status}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{item.environmentId}</span>
        <span>{item.resourceClass}</span>
        <span>integration: {item.integrationStatus}</span>
      </div>
    </button>
  );
}
