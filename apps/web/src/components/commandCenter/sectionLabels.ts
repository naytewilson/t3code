import type { CommandCenterSection } from "@t3tools/client-runtime/commandCenter";

export const COMMAND_CENTER_SECTION_LABELS: Record<CommandCenterSection, string> = {
  "needs-attention": "Needs attention",
  active: "Active",
  "ready-for-review": "Ready for review",
  "ready-to-use": "Ready to use",
  "node-activity": "Node activity",
};

export const COMMAND_CENTER_SECTION_ORDER: ReadonlyArray<CommandCenterSection> = [
  "needs-attention",
  "active",
  "ready-for-review",
  "ready-to-use",
  "node-activity",
];
