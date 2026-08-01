import {
  groupCardsBySection,
  type CommandCenterSnapshot,
} from "@t3tools/client-runtime/commandCenter";
import { useMemo } from "react";

import { NodeActivityCard, ProjectCard } from "./ProjectCard";
import { COMMAND_CENTER_SECTION_LABELS, COMMAND_CENTER_SECTION_ORDER } from "./sectionLabels";
import { cn } from "~/lib/utils";

export function ProjectsHome({
  snapshot,
  onOpenDeepLink,
  className,
}: {
  readonly snapshot: CommandCenterSnapshot;
  readonly onOpenDeepLink?: (deepLink: string) => void;
  readonly className?: string;
}) {
  const grouped = useMemo(() => groupCardsBySection(snapshot.cards), [snapshot.cards]);

  return (
    <div
      data-testid="projects-home"
      data-sequence={snapshot.sequence}
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-6",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Active work, attention items, review, ready outputs, and node activity.
        </p>
      </header>

      {COMMAND_CENTER_SECTION_ORDER.map((section) => {
        if (section === "node-activity") {
          return (
            <section
              key={section}
              data-testid={`command-center-section-${section}`}
              className="flex flex-col gap-2"
            >
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {COMMAND_CENTER_SECTION_LABELS[section]}
              </h2>
              {snapshot.nodeActivity.length === 0 ? (
                <EmptySection label="No node activity" />
              ) : (
                <div className="grid gap-2">
                  {snapshot.nodeActivity.map((item) => (
                    <NodeActivityCard
                      key={item.id}
                      item={item}
                      onOpen={(laneId) => {
                        const card = snapshot.cards.find((entry) => entry.lane.id === laneId);
                        if (card) onOpenDeepLink?.(card.deepLink);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        }

        const cards = grouped[section];
        return (
          <section
            key={section}
            data-testid={`command-center-section-${section}`}
            className="flex flex-col gap-2"
          >
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {COMMAND_CENTER_SECTION_LABELS[section]}
              <span className="ml-2 text-muted-foreground/70">{cards.length}</span>
            </h2>
            {cards.length === 0 ? (
              <EmptySection
                label={`No ${COMMAND_CENTER_SECTION_LABELS[section].toLowerCase()} items`}
              />
            ) : (
              <div className="grid gap-2">
                {cards.map((card) => (
                  <ProjectCard key={card.lane.id} card={card} onOpen={onOpenDeepLink} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function EmptySection({ label }: { readonly label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
