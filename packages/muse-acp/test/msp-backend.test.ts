import { describe, expect, it } from "vite-plus/test";

import {
  MspBackend,
  type MspClientPort,
  type MspConnectionPort,
  type MspSessionPort,
  type MspTurnPort,
} from "../src/msp-backend.js";

async function* empty(): AsyncIterableIterator<never> {}

function fakeTurn(turnId = "turn-1"): MspTurnPort {
  return {
    turnId,
    items: () => empty(),
    deltas: () => empty(),
    completed: Promise.resolve({ kind: "completed", terminal: "completed" }),
  };
}

class FakeSession implements MspSessionPort {
  readonly sessionId: string;
  readonly turn: MspTurnPort;
  approvalHandler: ((request: Record<string, unknown>) => Promise<{ choiceId: string }>) | undefined;
  sent: Array<Record<string, unknown>> = [];

  constructor(sessionId: string, turn = fakeTurn()) {
    this.sessionId = sessionId;
    this.turn = turn;
  }

  onApproval(handler: (request: Record<string, unknown>) => Promise<{ choiceId: string }>): void {
    this.approvalHandler = handler;
  }

  async sendUserTurn(input: Record<string, unknown>): Promise<MspTurnPort> {
    this.sent.push(input);
    return this.turn;
  }
}

class FakeClient implements MspClientPort {
  starts: Array<Record<string, unknown>> = [];
  resumes: Array<Record<string, unknown>> = [];
  closed = false;
  readonly session: FakeSession;

  constructor(session: FakeSession) {
    this.session = session;
  }

  async startSession(input: Record<string, unknown>): Promise<MspSessionPort> {
    this.starts.push(input);
    return this.session;
  }

  async resumeSession(input: Record<string, unknown>): Promise<MspSessionPort> {
    this.resumes.push(input);
    return this.session;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeConnection implements MspConnectionPort {
  commands: Array<{ method: string; params: Record<string, unknown> }> = [];

  async command(method: string, params: Record<string, unknown>): Promise<unknown> {
    this.commands.push({ method, params });
    return { status: "accepted" };
  }
}

describe("official MSP backend", () => {
  it("starts and resumes sessions through the Muse SDK client", async () => {
    const session = new FakeSession("native-session");
    const client = new FakeClient(session);
    const connection = new FakeConnection();
    const backend = new MspBackend(async () => ({ client, connection }));

    const started = await backend.startSession("/repo");
    expect(started.sessionId).toBe("native-session");
    expect(client.starts).toEqual([{ workspaceRoot: "/repo" }]);

    const resumed = await backend.resumeSession("native-session");
    expect(resumed.sessionId).toBe("native-session");
    expect(client.resumes).toEqual([{ sessionId: "native-session" }]);
  });

  it("sends user text as a native Muse turn", async () => {
    const session = new FakeSession("native-session");
    const client = new FakeClient(session);
    const backend = new MspBackend(async () => ({ client, connection: new FakeConnection() }));

    const wrapped = await backend.startSession("/repo");
    const turn = await wrapped.sendText("hello Muse");

    expect(turn.turnId).toBe("turn-1");
    expect(session.sent).toEqual([{ input: [{ type: "text", text: "hello Muse" }] }]);
  });

  it("uses MSP turn/cancel and does not synthesize the turn outcome", async () => {
    const session = new FakeSession("native-session");
    const client = new FakeClient(session);
    const connection = new FakeConnection();
    const backend = new MspBackend(async () => ({ client, connection }));

    await backend.cancel("native-session", "turn-77");
    expect(connection.commands).toEqual([
      {
        method: "turn/cancel",
        params: { sessionId: "native-session", turnId: "turn-77" },
      },
    ]);
  });

  it("closes the owned Muse SDK client", async () => {
    const session = new FakeSession("native-session");
    const client = new FakeClient(session);
    const backend = new MspBackend(async () => ({ client, connection: new FakeConnection() }));

    await backend.startSession("/repo");
    await backend.close();
    expect(client.closed).toBe(true);
  });
});
