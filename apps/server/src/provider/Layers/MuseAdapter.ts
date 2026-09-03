import {
  ProviderDriverKind,
  type MuseSettings,
  type ProviderInstanceId,
  type ProviderInteractionMode,
  type RuntimeMode,
} from "@t3tools/contracts";

import {
  makeDirectCliAdapter,
  type DirectCliParsedLine,
  type DirectCliTurnArgsInput,
} from "./DirectCliAdapter.ts";

const PROVIDER = ProviderDriverKind.make("muse");

export function buildMuseExecArgs(input: {
  readonly prompt: string;
  readonly sessionId: string;
  readonly model?: string;
  readonly reasoningEffort?: string;
  readonly runtimeMode?: RuntimeMode;
  readonly interactionMode?: ProviderInteractionMode;
}): string[] {
  const args = ["exec", "--json", "--session-id", input.sessionId];
  if (input.model && input.model !== "default") {
    args.push("--model", input.model);
  }
  if (input.reasoningEffort && input.reasoningEffort !== "default") {
    args.push("--reasoning-effort", input.reasoningEffort);
  }
  if (input.interactionMode === "plan") {
    args.push("--trust-workspace", "--disable-approval", "--disable-write", "--disable-shell");
  } else if (input.runtimeMode === "full-access") {
    args.push("--yolo");
  } else if (input.runtimeMode === "auto-accept-edits" || input.runtimeMode === "auto") {
    args.push("--trust-workspace", "--disable-approval");
  }
  args.push(input.prompt);
  return args;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseMuseJsonLine(line: string): DirectCliParsedLine | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(raw)) return undefined;
  const payloadType = raw.payload_type;
  const payload = raw.payload;
  if (payloadType === "run.output.delta" && isRecord(payload) && typeof payload.text === "string") {
    return { kind: "assistant_delta", text: payload.text };
  }
  if (
    typeof payloadType === "string" &&
    payloadType.startsWith("run.terminal.") &&
    isRecord(payload)
  ) {
    const terminal = typeof payload.terminal === "string" ? payload.terminal : "completed";
    const finalText = typeof payload.text === "string" ? payload.text : undefined;
    const reason = typeof payload.reason === "string" ? payload.reason : undefined;
    return {
      kind: "result",
      subtype: terminal === "completed" || terminal === "success" ? "success" : terminal,
      ...(finalText ? { finalText } : {}),
      ...(reason ? { stopReason: reason } : {}),
      ...(terminal === "completed" || terminal === "success" || !reason
        ? {}
        : { error: reason }),
    };
  }
  return undefined;
}

export const makeMuseAdapter = (
  settings: MuseSettings,
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
    sessionIdMode: "required-before-first-turn",
    buildArgs: (input: DirectCliTurnArgsInput) =>
      buildMuseExecArgs({
        prompt: input.prompt,
        sessionId: input.sessionId ?? "missing-session-id",
        ...(input.model ? { model: input.model } : {}),
        ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
        runtimeMode: input.runtimeMode,
        interactionMode: input.interactionMode,
      }),
    parseStdoutLine: parseMuseJsonLine,
  });
