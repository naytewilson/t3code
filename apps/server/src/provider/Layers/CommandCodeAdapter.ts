import {
  ProviderDriverKind,
  type CommandCodeSettings,
  type ProviderInstanceId,
  type ProviderInteractionMode,
  type RuntimeMode,
} from "@t3tools/contracts";

import {
  makeDirectCliAdapter,
  type DirectCliParsedLine,
  type DirectCliTurnArgsInput,
} from "./DirectCliAdapter.ts";

const PROVIDER = ProviderDriverKind.make("commandcode");

export function buildCommandCodeArgs(input: {
  readonly prompt: string;
  readonly sessionId?: string;
  readonly model?: string;
  readonly reasoningEffort?: string;
  readonly runtimeMode: RuntimeMode;
  readonly interactionMode: ProviderInteractionMode;
}): string[] {
  const args = [
    "-p",
    input.prompt,
    "--output-format",
    "json",
    "--verbose",
    "--skip-onboarding",
    "--trust",
  ];
  if (input.sessionId) {
    args.push("--resume", input.sessionId);
  }
  if (input.model && input.model !== "default") {
    args.push("--model", input.model);
  }
  if (input.reasoningEffort && input.reasoningEffort !== "default") {
    args.push("--effort", input.reasoningEffort);
  }
  if (input.interactionMode === "plan") {
    args.push("--permission-mode", "plan");
  } else if (input.runtimeMode === "full-access") {
    args.push("--yolo");
  } else if (input.runtimeMode === "auto-accept-edits") {
    args.push("--permission-mode", "auto-accept");
  }
  return args;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCommandCodeSessionLine(line: string): string | undefined {
  const match = line.trim().match(/^session\s*:\s*(\S+)\s*$/iu);
  return match?.[1];
}

export function parseCommandCodeJsonLine(line: string): DirectCliParsedLine | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(raw) || typeof raw.type !== "string") return undefined;

  if (raw.type === "event" && isRecord(raw.event)) {
    const event = raw.event;
    const eventType = typeof event.type === "string" ? event.type : "";
    const text =
      typeof event.text === "string"
        ? event.text
        : typeof event.delta === "string"
          ? event.delta
          : undefined;
    if (
      text !== undefined &&
      (eventType === "text_delta" ||
        eventType === "assistant_text_delta" ||
        eventType === "message_delta")
    ) {
      return { kind: "assistant_delta", text };
    }
    return undefined;
  }

  if (raw.type === "result") {
    return {
      kind: "result",
      ...(typeof raw.subtype === "string" ? { subtype: raw.subtype } : {}),
      ...(typeof raw.sessionId === "string" ? { sessionId: raw.sessionId } : {}),
      ...(typeof raw.stopReason === "string" ? { stopReason: raw.stopReason } : {}),
      ...(typeof raw.finalText === "string" ? { finalText: raw.finalText } : {}),
      ...(typeof raw.error === "string" ? { error: raw.error } : {}),
    };
  }
  return undefined;
}

export const makeCommandCodeAdapter = (
  settings: CommandCodeSettings,
  options: {
    readonly environment: NodeJS.ProcessEnv;
    readonly instanceId: ProviderInstanceId;
  },
) =>
  makeDirectCliAdapter({
    provider: PROVIDER,
    instanceId: options.instanceId,
    binaryPath: settings.binaryPath,
    environment: options.environment,
    sessionIdMode: "reported-by-cli",
    buildArgs: (input: DirectCliTurnArgsInput) =>
      buildCommandCodeArgs({
        prompt: input.prompt,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
        runtimeMode: input.runtimeMode,
        interactionMode: input.interactionMode,
      }),
    parseStdoutLine: parseCommandCodeJsonLine,
    parseSessionLine: parseCommandCodeSessionLine,
  });
