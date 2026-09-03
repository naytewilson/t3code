import {
  approvalChoicesToAcpOptions,
  museDeltaToAcpUpdate,
  museItemToAcpUpdate,
  museOutcomeToAcpStopReason,
  promptBlocksToText,
  type MuseApprovalChoiceLike,
  type MuseDeltaLike,
  type MuseItemLike,
  type MuseOutcomeLike,
  type PromptBlockLike,
} from "./translation.js";

export interface AcpClientPort {
  sessionUpdate(payload: Record<string, unknown>): Promise<void>;
  requestPermission(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface MuseBackendTurn {
  readonly turnId: string;
  items(): AsyncIterableIterator<MuseItemLike>;
  deltas(): AsyncIterableIterator<MuseDeltaLike>;
  readonly completed: Promise<MuseOutcomeLike>;
}

export interface MuseBackendSession {
  readonly sessionId: string;
  onApproval(
    handler: (request: Record<string, unknown>) => Promise<{ readonly choiceId: string }>,
  ): void;
  sendText(text: string): Promise<MuseBackendTurn>;
}

export interface MuseBackend {
  startSession(workspaceRoot: string): Promise<MuseBackendSession>;
  resumeSession(sessionId: string): Promise<MuseBackendSession>;
  cancel(sessionId: string, turnId: string): Promise<void>;
  close(): Promise<void>;
}

export interface AcpNewSessionInput {
  readonly cwd: string;
}

export interface AcpLoadSessionInput {
  readonly sessionId: string;
  readonly cwd?: string;
}

export interface AcpPromptInput {
  readonly sessionId: string;
  readonly prompt: ReadonlyArray<PromptBlockLike>;
}

export interface AcpCancelInput {
  readonly sessionId: string;
}

interface SessionState {
  readonly session: MuseBackendSession;
  activeTurnId: string | null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function strings(value: unknown): ReadonlyArray<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = object(entry);
    return parsed === null ? [] : [parsed];
  });
}

function approvalChoice(value: Record<string, unknown>): MuseApprovalChoiceLike | null {
  const choiceId = value["choiceId"];
  const decision = value["decision"];
  const label = value["label"];
  const scope = value["scope"];
  if (typeof choiceId !== "string" || typeof decision !== "string" || typeof label !== "string") {
    return null;
  }
  return {
    choiceId,
    decision,
    label,
    ...(typeof scope === "string" ? { scope } : {}),
  };
}

function selectedOptionId(response: Record<string, unknown>): string | null {
  const outcome = object(response["outcome"]);
  if (outcome?.["outcome"] !== "selected") return null;
  const optionId = outcome["optionId"];
  return typeof optionId === "string" ? optionId : null;
}

function approvalToolTitle(request: Record<string, unknown>): string {
  const tool = request["tool"];
  return typeof tool === "string" && tool.length > 0 ? tool : "Muse approval";
}

function approvalToolCallId(request: Record<string, unknown>): string {
  const itemId = request["itemId"];
  if (typeof itemId === "string" && itemId.length > 0) return itemId;
  const approvalId = request["approvalId"];
  return typeof approvalId === "string" && approvalId.length > 0 ? approvalId : "muse-approval";
}

export class MuseAcpAgent {
  readonly #client: AcpClientPort;
  readonly #backend: MuseBackend;
  readonly #sessions = new Map<string, SessionState>();

  constructor(client: AcpClientPort, backend: MuseBackend) {
    this.#client = client;
    this.#backend = backend;
  }

  async newSession(input: AcpNewSessionInput): Promise<{ readonly sessionId: string }> {
    const session = await this.#backend.startSession(input.cwd);
    this.#register(session);
    return { sessionId: session.sessionId };
  }

  async loadSession(input: AcpLoadSessionInput): Promise<Record<string, never>> {
    const session = await this.#backend.resumeSession(input.sessionId);
    if (session.sessionId !== input.sessionId) {
      throw new Error(
        `Muse resumed session ${session.sessionId}, expected exact session ${input.sessionId}`,
      );
    }
    this.#register(session);
    return {};
  }

  async prompt(input: AcpPromptInput): Promise<{ readonly stopReason: "end_turn" | "cancelled" }> {
    const state = this.#sessions.get(input.sessionId);
    if (state === undefined) throw new Error(`Unknown Muse session: ${input.sessionId}`);

    const text = promptBlocksToText(input.prompt);
    if (text.length === 0) throw new Error("Muse prompt contained no text input");

    const turn = await state.session.sendText(text);
    state.activeTurnId = turn.turnId;

    try {
      await this.#streamTurn(input.sessionId, turn);
      const outcome = await turn.completed;
      return { stopReason: museOutcomeToAcpStopReason(outcome) };
    } finally {
      if (state.activeTurnId === turn.turnId) state.activeTurnId = null;
    }
  }

  async cancel(input: AcpCancelInput): Promise<void> {
    const state = this.#sessions.get(input.sessionId);
    if (state?.activeTurnId === null || state?.activeTurnId === undefined) return;
    await this.#backend.cancel(input.sessionId, state.activeTurnId);
  }

  async close(): Promise<void> {
    await this.#backend.close();
  }

  #register(session: MuseBackendSession): void {
    const state: SessionState = { session, activeTurnId: null };
    this.#sessions.set(session.sessionId, state);
    session.onApproval((request) => this.#approval(session.sessionId, request));
  }

  async #approval(
    sessionId: string,
    request: Record<string, unknown>,
  ): Promise<{ readonly choiceId: string }> {
    const choices = strings(request["availableChoices"]).flatMap((value) => {
      const parsed = approvalChoice(value);
      return parsed === null ? [] : [parsed];
    });
    if (choices.length === 0) throw new Error("Muse approval carried no usable server choices");

    const response = await this.#client.requestPermission({
      sessionId,
      toolCall: {
        toolCallId: approvalToolCallId(request),
        title: approvalToolTitle(request),
        kind: "other",
        status: "pending",
        rawInput: {
          museApprovalId: request["approvalId"],
          museItemId: request["itemId"],
        },
      },
      options: approvalChoicesToAcpOptions(choices),
    });

    const selected = selectedOptionId(response);
    if (selected !== null && choices.some((choice) => choice.choiceId === selected)) {
      return { choiceId: selected };
    }

    const denied = choices.find((choice) => choice.decision === "denied");
    if (denied !== undefined) return { choiceId: denied.choiceId };
    throw new Error("ACP client did not select a Muse-offered approval choice");
  }

  async #streamTurn(sessionId: string, turn: MuseBackendTurn): Promise<void> {
    const itemKinds = new Map<string, string>();
    const pendingDeltas = new Map<string, MuseDeltaLike[]>();

    const emit = async (update: Record<string, unknown> | null): Promise<void> => {
      if (update === null) return;
      await this.#client.sessionUpdate({ sessionId, update });
    };

    const flush = async (itemId: string): Promise<void> => {
      const kind = itemKinds.get(itemId);
      if (kind === undefined) return;
      const queued = pendingDeltas.get(itemId);
      if (queued === undefined) return;
      pendingDeltas.delete(itemId);
      for (const delta of queued) {
        await emit(museDeltaToAcpUpdate(kind, delta));
      }
    };

    const consumeItems = async (): Promise<void> => {
      for await (const item of turn.items()) {
        itemKinds.set(item.itemId, item.kind);
        await emit(museItemToAcpUpdate(item));
        await flush(item.itemId);
      }
    };

    const consumeDeltas = async (): Promise<void> => {
      for await (const delta of turn.deltas()) {
        const kind = itemKinds.get(delta.itemId);
        if (kind === undefined) {
          const queued = pendingDeltas.get(delta.itemId) ?? [];
          queued.push(delta);
          pendingDeltas.set(delta.itemId, queued);
          continue;
        }
        await emit(museDeltaToAcpUpdate(kind, delta));
      }
    };

    await Promise.all([consumeItems(), consumeDeltas()]);
  }
}
