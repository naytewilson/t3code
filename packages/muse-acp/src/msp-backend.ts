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

export interface MspConnectionPort {
  command(method: string, params: Record<string, unknown>): Promise<unknown>;
}

export interface MspRuntime {
  readonly client: MspClientPort;
  readonly connection: MspConnectionPort;
}

export type MspRuntimeFactory = () => Promise<MspRuntime>;

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

  constructor(factory: MspRuntimeFactory = spawnOfficialMspRuntime) {
    this.#factory = factory;
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
    const runtime = this.#runtimePromise === null ? null : await this.#runtimePromise;
    if (runtime !== null) await runtime.client.close();
    this.#runtimePromise = null;
  }

  #runtime(): Promise<MspRuntime> {
    this.#runtimePromise ??= this.#factory().catch((error) => {
      this.#runtimePromise = null;
      throw error;
    });
    return this.#runtimePromise;
  }
}
