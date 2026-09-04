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

export interface CommandCodeListedModel {
  readonly slug: string;
  readonly shortName: string;
}

const MODEL_LIST_LINE = /^(\S+)\s{2,}(\S.*)$/;

/**
 * parseCommandCodeModelList — parse `command-code --list-models` stdout into
 * vendor-qualified model ids.
 *
 * Observed format (v1.15.1): a title line, blank line, vendor group headers
 * (`Open Source`, `Meta`, …), then one model per line as
 * `<vendor/name><2+ spaces><description>`, then usage-hint footer lines.
 *
 * Robustness rules (deliberately structural, not a hardcoded model list):
 * - a line must match `<token><2+ spaces><rest>` — single-space prose
 *   (title, group headers, footer hints, `Docs:` line) never matches;
 * - the leading token must look like a model id: vendor-qualified (`a/b`)
 *   or hyphenated (`claude-opus-5`) — group headers (`Open Source`,
 *   `Anthropic`) and prose never qualify, while real ids always do;
 * - duplicates collapse; anything unparseable is skipped, never fatal.
 */
export function parseCommandCodeModelList(output: string): CommandCodeListedModel[] {
  const models: CommandCodeListedModel[] = [];
  const seen = new Set<string>();
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim().length === 0) continue;
    const match = line.match(MODEL_LIST_LINE);
    if (!match) continue;
    const slug = match[1]!;
    if (!slug.includes("/") && !slug.includes("-")) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    models.push({ slug, shortName: slug.slice(slug.lastIndexOf("/") + 1) });
  }
  return models;
}
