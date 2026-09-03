export interface PromptBlockLike {
  readonly type: string;
  readonly text?: string;
}

export interface MuseDeltaLike {
  readonly itemId: string;
  readonly field?: string;
  readonly delta: string;
}

export interface MuseItemLike {
  readonly itemId: string;
  readonly kind: string;
  readonly revision: number;
  readonly status: string;
  readonly tool?: string;
  readonly visibleOutput?: string;
  readonly failureReason?: string;
  readonly fallbackText?: string;
  readonly role?: string;
  readonly objective?: string;
  readonly message?: string;
}

export interface MuseApprovalChoiceLike {
  readonly choiceId: string;
  readonly decision: string;
  readonly label: string;
  readonly scope?: string;
}

export type MuseOutcomeLike =
  | {
      readonly kind: "completed";
      readonly terminal?: string;
      readonly params?: { readonly terminal?: string };
    }
  | { readonly kind: "unqueued" }
  | { readonly kind: "terminalUnknown" }
  | { readonly kind: string };

export type AcpStopReason = "end_turn" | "cancelled";

export type AcpSessionUpdate = Record<string, unknown>;

export function promptBlocksToText(blocks: ReadonlyArray<PromptBlockLike>): string {
  return blocks
    .filter((block): block is PromptBlockLike & { readonly text: string } => {
      return block.type === "text" && typeof block.text === "string";
    })
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

export function museDeltaToAcpUpdate(
  itemKind: string | undefined,
  delta: MuseDeltaLike,
): AcpSessionUpdate | null {
  if (delta.delta.length === 0) return null;

  if (itemKind === "agentMessage") {
    return {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: delta.delta },
    };
  }

  if (itemKind === "reasoning") {
    return {
      sessionUpdate: "agent_thought_chunk",
      content: { type: "text", text: delta.delta },
    };
  }

  if (itemKind === "toolCall" || itemKind === "userShell") {
    return {
      sessionUpdate: "tool_call_update",
      toolCallId: delta.itemId,
      content: [
        {
          type: "content",
          content: { type: "text", text: delta.delta },
        },
      ],
    };
  }

  return null;
}

function toAcpToolStatus(status: string): "in_progress" | "completed" | "failed" {
  if (status === "inProgress") return "in_progress";
  if (status === "completed") return "completed";
  return "failed";
}

function toolKindForMuseItem(item: MuseItemLike): string {
  if (item.kind === "userShell") return "execute";
  if (item.kind !== "toolCall") return "other";

  const tool = item.tool?.toLowerCase() ?? "";
  if (/read|cat|view/.test(tool)) return "read";
  if (/edit|write|patch|replace/.test(tool)) return "edit";
  if (/delete|remove|unlink/.test(tool)) return "delete";
  if (/search|grep|find|glob/.test(tool)) return "search";
  if (/fetch|curl|http|web/.test(tool)) return "fetch";
  if (/shell|exec|command|terminal|bash|zsh|sh/.test(tool)) return "execute";
  return "other";
}

function toolTitle(item: MuseItemLike): string {
  if (item.tool && item.tool.length > 0) return item.tool;
  if (item.kind === "subagent") {
    return item.role ? `${item.role} subagent` : "Muse subagent";
  }
  if (item.kind === "workflow") return "Muse workflow";
  if (item.kind === "userShell") return "Muse shell";
  return item.fallbackText || `Muse ${item.kind}`;
}

function toolContent(item: MuseItemLike): ReadonlyArray<Record<string, unknown>> | undefined {
  const text =
    item.visibleOutput ?? item.failureReason ?? item.message ?? item.objective ?? item.fallbackText;
  if (!text) return undefined;
  return [
    {
      type: "content",
      content: { type: "text", text },
    },
  ];
}

export function museItemToAcpUpdate(item: MuseItemLike): AcpSessionUpdate | null {
  if (item.kind === "agentMessage" || item.kind === "reasoning" || item.kind === "userMessage") {
    return null;
  }

  const status = toAcpToolStatus(item.status);
  const content = toolContent(item);
  const isInitial = item.revision <= 1;

  if (isInitial) {
    return {
      sessionUpdate: "tool_call",
      toolCallId: item.itemId,
      title: toolTitle(item),
      kind: toolKindForMuseItem(item),
      status,
      ...(content ? { content } : {}),
      rawInput: {
        museKind: item.kind,
        ...(item.role ? { role: item.role } : {}),
        ...(item.objective ? { objective: item.objective } : {}),
      },
    };
  }

  return {
    sessionUpdate: "tool_call_update",
    toolCallId: item.itemId,
    status,
    ...(content ? { content } : {}),
    rawOutput: {
      museKind: item.kind,
      museStatus: item.status,
      ...(item.failureReason ? { failureReason: item.failureReason } : {}),
    },
  };
}

export function approvalChoicesToAcpOptions(
  choices: ReadonlyArray<MuseApprovalChoiceLike>,
): Array<{ optionId: string; name: string; kind: "allow_once" | "allow_always" | "reject_once" }> {
  return choices.map((choice) => {
    if (choice.decision === "approved") {
      return {
        optionId: choice.choiceId,
        name: choice.label,
        kind: choice.scope === "session" ? "allow_always" : "allow_once",
      };
    }
    return {
      optionId: choice.choiceId,
      name: choice.label,
      kind: "reject_once",
    };
  });
}

export function museOutcomeToAcpStopReason(outcome: MuseOutcomeLike): AcpStopReason {
  if (outcome.kind === "unqueued" || outcome.kind === "terminalUnknown") return "cancelled";
  if (outcome.kind !== "completed") return "cancelled";

  const terminal = outcome.terminal ?? outcome.params?.terminal;
  return terminal === "cancelled" ? "cancelled" : "end_turn";
}
