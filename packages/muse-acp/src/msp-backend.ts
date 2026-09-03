import {
  MuseClient,
  readSessionDurability,
  spawnMspConnection,
  type Session,
  type Turn,
  type TurnOutcome,
} from "@muse-code/sdk";

import type {
  MuseBackend,
  MuseBackendSession,
  MuseBackendTurn,
} from "./agent.js";
import type {
  MuseDeltaLike,
  MuseItemLike,
  MuseOutcomeLike,
} from "./translation.js";
import {
  acpElicitationToMuseCommand,
  type AcpElicitationResponse,
  type MuseUserInputQuestion,
  type MuseUserInputRequest,
} from "./user-input.js";

export interface MspTurnPort {
  readonly turnId: string;
  items(): AsyncIterableIterator<MuseItemLike>;
  deltas(): AsyncIterableIterator<MuseDeltaLike>;
  readonly completed: Promise<MuseOutcomeLike>;
}

export interface MspSessionPort {
  readonly sessionId: string;
  onApproval(
    handler: (request: Record<string, unknown>) => Promise<{ readonly choiceId: string }>,
  ): void;
  sendUserTurn(input: {
    readonly input: ReadonlyArray<{ readonly type: "text"; readonly text: string }>;
  }): Promise<MspTurnPort>;
}

export interface MspClientPort {
  startSession(input: { readonly workspaceRoot: string }): Promise<MspSessionPort>;
  resumeSession(input: { readonly sessionId: string }): Promise<MspSessionPort>;
  close(): Promise<void>;
}

export interface MspServerRequest {
  readonly method: string;
  readonly params?: unknown;
}

export interface MspConnectionPort {
  command(method: string, params: Record<string, unknown>): Promise<unknown>;
  onServerRequest?(
    handler: (request: MspServerRequest) => Promise<Record<string, unknown>>,
  ): void;
  flush?(): Promise<void>;
}

export interface MspRuntime {
  readonly client: MspClientPort;
  readonly connection: MspConnectionPort;
}

export type MspRuntimeFactory = () => Promise<MspRuntime>;
export type MuseUserInputHandler = (
  request: MuseUserInputRequest,
) => Promise<AcpElicitationResponse>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringField(value: Record<string, unknown>, key: string, label: string): string {
  const result = value[key];
  if (typeof result !== "string" || result.length === 0) {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }
  return result;
}

function optionalNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function parseQuestion(value: unknown): MuseUserInputQuestion {
  const question = record(value, "Muse userInput question");
  const selection = record(question["selection"], "Muse userInput selection");
  const mode = selection["mode"];
  if (mode !== "single" && mode !== "multiple") {
    throw new Error(`unsupported Muse user-input selection mode: ${String(mode)}`);
  }
  const rawOptions = question["options"];
  if (!Array.isArray(rawOptions)) throw new Error("Muse user-input options must be an array");
  const options = rawOptions.map((entry) => {
    const option = record(entry, "Muse userInput option");
    return { ...option, label: stringField(option, "label", "Muse userInput option") };
  });
  const minSelections = optionalNonNegativeInteger(selection["minSelections"]);
  const maxSelections = optionalNonNegativeInteger(selection["maxSelections"]);
  return {
    id: stringField(question, "id", "Muse userInput question"),
    header: stringField(question, "header", "Muse userInput question"),
    question: stringField(question, "question", "Muse userInput question"),
    selection: {
      mode,
      ...(minSelections === undefined ? {} : { minSelections }),
      ...(maxSelections === undefined ? {} : { maxSelections }),
    },
    options,
  };
}

function parseUserInputRequest(params: unknown): MuseUserInputRequest {
  const input = record(params, "Muse userInput/request params");
  const rawQuestions = input["questions"];
  if (!Array.isArray(rawQuestions)) {
    throw new Error("Muse userInput/request questions must be an array");
  }
  const autoResolutionMs = optionalNonNegativeInteger(input["autoResolutionMs"]);
  return {
    sessionId: stringField(input, "sessionId", "Muse userInput/request"),
    userInputId: stringField(input, "userInputId", "Muse userInput/request"),
    turnId: stringField(input, "turnId", "Muse userInput/request"),
    itemId: stringField(input, "itemId", "Muse userInput/request"),
    questions: rawQuestions.map(parseQuestion),
    ...(autoResolutionMs === undefined ? {} : { autoResolutionMs }),
  };
}

function adaptOutcome(outcome: TurnOutcome): MuseOutcomeLike {
  switch (outcome.kind) {
    case "completed":
      return {
        kind: "completed",
        params: { terminal: outcome.params.terminal },
      };
    case "unqueued":
      return { kind: "unqueued" };
    case "terminalUnknown":
      return { kind: "terminalUnknown" };
  }
}

function adaptTurn(turn: Turn): MspTurnPort {
  return {
    turnId: turn.turnId,
    async *items() {
      for await (const item of turn.items()) {
        yield item as MuseItemLike;
      }
    },
    async *deltas() {
      for await (const delta of turn.deltas()) {
        yield delta as MuseDeltaLike;
      }
    },
    completed: turn.completed.then(adaptOutcome),
  };
}

function adaptSession(session: Session<unknown>): MspSessionPort {
  return {
    sessionId: session.sessionId,
    onApproval(handler) {
      session.onApproval(async (request) => {
        const decision = await handler(request as unknown as Record<string, unknown>);
        return { choiceId: decision.choiceId };
      });
    },
    async sendUserTurn(input) {
      const turn = await session.sendUserTurn({ input: [...input.input] });
      return adaptTurn(turn);
    },
  };
}

export async function spawnOfficialMspRuntime(): Promise<MspRuntime> {
  const museBin = process.env["MUSE_BIN"]?.trim() || "muse";
  const handshake = spawnMspConnection({
    command: museBin,
    args: ["serve"],
    env: { ...process.env },
  });

  let spawned;
  try {
    spawned = await handshake.initialize({
      clientInfo: { name: "muse-acp", version: "0.1.0" },
    });
  } catch (error) {
    await handshake.close().catch(() => undefined);
    throw error;
  }

  const sdkClient = new MuseClient(spawned.connection, {
    durability: readSessionDurability(spawned.initializeResult),
    host: spawned,
  });

  const client: MspClientPort = {
    async startSession(input) {
      return adaptSession(await sdkClient.startSession({ workspaceRoot: input.workspaceRoot }));
    },
    async resumeSession(input) {
      return adaptSession(await sdkClient.resumeSession({ sessionId: input.sessionId }));
    },
    close: () => sdkClient.close(),
  };

  const connection: MspConnectionPort = {
    command: (method, params) => spawned.connection.command(method, params),
    onServerRequest: (handler) => spawned.connection.onServerRequest(handler),
    flush: () => spawned.connection.flush(),
  };

  return { client, connection };
}

class BackendSession implements MuseBackendSession {
  readonly #session: MspSessionPort;

  constructor(session: MspSessionPort) {
    this.#session = session;
  }

  get sessionId(): string {
    return this.#session.sessionId;
  }

  onApproval(
    handler: (request: Record<string, unknown>) => Promise<{ readonly choiceId: string }>,
  ): void {
    this.#session.onApproval(handler);
  }

  async sendText(text: string): Promise<MuseBackendTurn> {
    return await this.#session.sendUserTurn({
      input: [{ type: "text", text }],
    });
  }
}

export class MspBackend implements MuseBackend {
  readonly #factory: MspRuntimeFactory;
  #runtimePromise: Promise<MspRuntime> | null = null;
  #userInputHandler: MuseUserInputHandler | null = null;
  readonly #background = new Set<Promise<void>>();

  constructor(factory: MspRuntimeFactory = spawnOfficialMspRuntime) {
    this.#factory = factory;
  }

  onUserInput(handler: MuseUserInputHandler): void {
    this.#userInputHandler = handler;
  }

  async startSession(workspaceRoot: string): Promise<MuseBackendSession> {
    const runtime = await this.#runtime();
    const session = await runtime.client.startSession({ workspaceRoot });
    return new BackendSession(session);
  }

  async resumeSession(sessionId: string): Promise<MuseBackendSession> {
    const runtime = await this.#runtime();
    const session = await runtime.client.resumeSession({ sessionId });
    return new BackendSession(session);
  }

  async cancel(sessionId: string, turnId: string): Promise<void> {
    const runtime = await this.#runtime();
    await runtime.connection.command("turn/cancel", { sessionId, turnId });
  }

  async close(): Promise<void> {
    const pending = [...this.#background];
    if (pending.length > 0) await Promise.allSettled(pending);
    const runtime = this.#runtimePromise === null ? null : await this.#runtimePromise;
    if (runtime !== null) await runtime.client.close();
    this.#runtimePromise = null;
  }

  #installServerRequests(runtime: MspRuntime): void {
    runtime.connection.onServerRequest?.(async (request) => {
      if (request.method !== "userInput/request") {
        throw new Error(`unhandled server request: ${request.method}`);
      }
      const handler = this.#userInputHandler;
      if (handler === null) {
        throw new Error("Muse requested user input but no ACP elicitation handler is registered");
      }

      const input = parseUserInputRequest(request.params);

      // MSP userInput/request is an acknowledgement of presentation, not the
      // eventual human choice. Return it immediately, then wait for ACP
      // elicitation off the request handler so Muse is never blocked on a
      // potentially minutes-long human response. setImmediate deliberately
      // yields past the JSON-RPC response write before we flush and issue the
      // follow-up userInput/answer or userInput/cancel command.
      setImmediate(() => {
        const pending = handler(input)
          .then((response) => acpElicitationToMuseCommand(input, response))
          .then(async (command) => {
            await (runtime.connection.flush?.() ?? Promise.resolve());
            await runtime.connection.command(command.method, command.params);
          });
        this.#background.add(pending);
        void pending.finally(() => this.#background.delete(pending));
      });

      return {};
    });
  }

  #runtime(): Promise<MspRuntime> {
    this.#runtimePromise ??= this.#factory()
      .then((runtime) => {
        this.#installServerRequests(runtime);
        return runtime;
      })
      .catch((error) => {
        this.#runtimePromise = null;
        throw error;
      });
    return this.#runtimePromise;
  }
}
