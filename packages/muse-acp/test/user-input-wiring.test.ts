import { describe, expect, it } from "vite-plus/test";

import {
  MuseAcpAgent,
  type AcpClientPort,
  type MuseBackend,
  type MuseBackendSession,
} from "../src/agent.js";
import {
  MspBackend,
  type MspClientPort,
  type MspConnectionPort,
  type MspRuntime,
  type MspSessionPort,
} from "../src/msp-backend.js";
import type {
  AcpElicitationResponse,
  MuseUserInputRequest,
} from "../src/user-input.js";

class AgentClient implements AcpClientPort {
  readonly elicitationRequests: Array<Record<string, unknown>> = [];
  async sessionUpdate(): Promise<void> {}
  async requestPermission(): Promise<Record<string, unknown>> {
    return { outcome: { outcome: "cancelled" } };
  }
  async createElicitation(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.elicitationRequests.push(payload);
    return { action: "accept", content: { target: "B" } };
  }
}

class BackendForAgent implements MuseBackend {
  userInputHandler:
    | ((request: MuseUserInputRequest) => Promise<AcpElicitationResponse>)
    | undefined;

  onUserInput(
    handler: (request: MuseUserInputRequest) => Promise<AcpElicitationResponse>,
  ): void {
    this.userInputHandler = handler;
  }

  async startSession(): Promise<MuseBackendSession> {
    throw new Error("unused");
  }
  async resumeSession(): Promise<MuseBackendSession> {
    throw new Error("unused");
  }
  async cancel(): Promise<void> {}
  async close(): Promise<void> {}
}

class ConnectionForBackend implements MspConnectionPort {
  readonly events: string[] = [];
  readonly commands: Array<{ method: string; params: Record<string, unknown> }> = [];
  serverRequestHandler:
    | ((request: { method: string; params?: unknown }) => Promise<Record<string, unknown>>)
    | undefined;

  onServerRequest(
    handler: (request: { method: string; params?: unknown }) => Promise<Record<string, unknown>>,
  ): void {
    this.serverRequestHandler = handler;
  }

  async flush(): Promise<void> {
    this.events.push("flush");
  }

  async command(method: string, params: Record<string, unknown>): Promise<unknown> {
    this.events.push(`command:${method}`);
    this.commands.push({ method, params });
    return { status: "accepted" };
  }
}

class ClientForBackend implements MspClientPort {
  async startSession(): Promise<MspSessionPort> {
    throw new Error("unused");
  }
  async resumeSession(): Promise<MspSessionPort> {
    throw new Error("unused");
  }
  async close(): Promise<void> {}
}

const request: MuseUserInputRequest = {
  sessionId: "session-1",
  userInputId: "input-1",
  turnId: "turn-1",
  itemId: "tool-1",
  questions: [
    {
      id: "target",
      header: "Target",
      question: "Which target?",
      selection: { mode: "single", minSelections: 1, maxSelections: 1 },
      options: [{ label: "A" }, { label: "B" }],
    },
  ],
};

describe("live Muse user-input routing", () => {
  it("registers an ACP elicitation handler on the backend", async () => {
    const client = new AgentClient();
    const backend = new BackendForAgent();
    new MuseAcpAgent(client, backend);

    expect(backend.userInputHandler).toBeTypeOf("function");
    const response = await backend.userInputHandler?.(request);
    expect(response).toEqual({ action: "accept", content: { target: "B" } });
    expect(client.elicitationRequests).toContainEqual(
      expect.objectContaining({
        mode: "form",
        sessionId: "session-1",
        toolCallId: "tool-1",
      }),
    );
  });

  it("acks userInput/request before waiting for the human, then sends the native answer", async () => {
    const connection = new ConnectionForBackend();
    const runtime: MspRuntime = { client: new ClientForBackend(), connection };
    const backend = new MspBackend(async () => runtime);
    let resolveHuman!: (value: AcpElicitationResponse) => void;
    const humanResponse = new Promise<AcpElicitationResponse>((resolve) => {
      resolveHuman = resolve;
    });
    backend.onUserInput(() => humanResponse);

    // Force runtime initialization and server-request registration.
    await backend.cancel("session-unused", "turn-unused");
    connection.commands.length = 0;
    connection.events.length = 0;

    const handler = connection.serverRequestHandler;
    expect(handler).toBeTypeOf("function");
    const ackPromise = handler?.({ method: "userInput/request", params: request });
    await expect(ackPromise).resolves.toEqual({});

    // The MSP request reply means "the UI is showing the question". It must
    // not wait minutes for the human answer, and no native answer may exist yet.
    expect(connection.commands).toEqual([]);

    resolveHuman({ action: "accept", content: { target: "B" } });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(connection.events).toEqual(["flush", "command:userInput/answer"]);
    expect(connection.commands).toEqual([
      {
        method: "userInput/answer",
        params: {
          sessionId: "session-1",
          userInputId: "input-1",
          answers: [{ questionId: "target", selectedLabel: "B" }],
        },
      },
    ]);
  });

  it("rejects unrelated MSP server requests instead of acknowledging capabilities it does not own", async () => {
    const connection = new ConnectionForBackend();
    const backend = new MspBackend(async () => ({ client: new ClientForBackend(), connection }));
    backend.onUserInput(async () => ({ action: "decline" }));
    await backend.cancel("session-unused", "turn-unused");

    await expect(
      connection.serverRequestHandler?.({ method: "unknown/request", params: {} }),
    ).rejects.toThrow(/unhandled server request/i);
  });
});
