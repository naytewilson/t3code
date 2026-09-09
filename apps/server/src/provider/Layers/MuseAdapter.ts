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
  type DirectCliParsedOutput,
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

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function museToolName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.startsWith("tool.") ? normalized.slice("tool.".length) : normalized;
}

function museCallId(value: unknown): string | undefined {
  const normalized = stringValue(value);
  if (!normalized) return undefined;
  return normalized.startsWith("tool:") ? normalized.slice("tool:".length) : normalized;
}

function parseMuseToolResult(
  payload: Record<string, unknown>,
): Extract<DirectCliParsedLine, { kind: "tool_call" }> | undefined {
  const toolCallId = stringValue(payload.call_id) ?? stringValue(payload.callId);
  const correlationFacts = isRecord(payload.correlation_facts)
    ? payload.correlation_facts
    : undefined;
  const toolName =
    museToolName(correlationFacts?.tool_name) ??
    museToolName(payload.tool_name) ??
    museToolName(payload.toolName) ??
    museToolName(payload.name);
  if (!toolCallId || !toolName) return undefined;
  const outcome = stringValue(correlationFacts?.outcome) ?? stringValue(payload.outcome);
  const output = payload.text ?? payload.output ?? payload.result;
  const successful = outcome === undefined || outcome === "success";
  return {
    kind: "tool_call",
    toolCallId,
    toolName,
    status: successful ? "completed" : "failed",
    ...(output !== undefined ? { output } : {}),
    ...(!successful && outcome ? { error: outcome } : {}),
  };
}

export function parseMuseJsonLine(line: string): DirectCliParsedOutput | undefined {
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
  if (payloadType === "tool.result" && isRecord(payload)) {
    return parseMuseToolResult(payload);
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
      ...(terminal === "completed" || terminal === "success" || !reason ? {} : { error: reason }),
    };
  }
  return undefined;
}

/**
 * The stable Muse JSON stream links tool lifecycle tasks to result records in
 * separate events: task_kind identifies the tool, while the scheduled event
 * carries the `tool:<call-id>` correlation. Keep that small correlation map in
 * the adapter rather than guessing arguments from human-readable output.
 */
export function makeMuseJsonLineParser(): (line: string) => DirectCliParsedOutput | undefined {
  const tasks = new Map<string, { readonly toolName: string; callId?: string }>();
  const calls = new Map<string, string>();

  return (line) => {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      return undefined;
    }
    if (!isRecord(raw) || typeof raw.payload_type !== "string") return undefined;
    const payload = raw.payload;
    if (!isRecord(payload)) return parseMuseJsonLine(line);

    if (raw.payload_type === "task.lifecycle.proposed" && isRecord(payload.event)) {
      const taskId = stringValue(payload.event.task_id);
      const toolName = museToolName(payload.event.task_kind);
      if (taskId && toolName) tasks.set(taskId, { toolName });
      return undefined;
    }

    if (raw.payload_type === "task.lifecycle.scheduled" && isRecord(payload.event)) {
      const taskId = stringValue(payload.event.task_id);
      const callId = museCallId(payload.event.idempotency_key);
      if (!taskId || !callId) return undefined;
      const task = tasks.get(taskId);
      if (!task) return undefined;
      tasks.set(taskId, { ...task, callId });
      calls.set(callId, task.toolName);
      return {
        kind: "tool_call",
        toolCallId: callId,
        toolName: task.toolName,
        status: "pending",
      };
    }

    if (raw.payload_type === "task.lifecycle.started" && isRecord(payload.event)) {
      const taskId = stringValue(payload.event.task_id);
      const task = taskId ? tasks.get(taskId) : undefined;
      if (!task?.callId) return undefined;
      return {
        kind: "tool_call",
        toolCallId: task.callId,
        toolName: task.toolName,
        status: "inProgress",
      };
    }

    if (raw.payload_type === "task.lifecycle.output" && isRecord(payload.event)) {
      const taskId = stringValue(payload.event.task_id);
      const task = taskId ? tasks.get(taskId) : undefined;
      const output = payload.event.chunk;
      if (!task?.callId || output === undefined) return undefined;
      return {
        kind: "tool_call",
        toolCallId: task.callId,
        toolName: task.toolName,
        status: "inProgress",
        output,
      };
    }

    if (raw.payload_type === "tool.result") {
      const parsed = parseMuseToolResult(payload);
      if (!parsed) return undefined;
      const toolName = calls.get(parsed.toolCallId) ?? parsed.toolName;
      const correlated = { ...parsed, toolName };
      calls.delete(parsed.toolCallId);
      for (const [taskId, task] of tasks) {
        if (task.callId === parsed.toolCallId) tasks.delete(taskId);
      }
      return correlated;
    }

    return parseMuseJsonLine(line);
  };
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
    parseStdoutLine: makeMuseJsonLineParser(),
  });
