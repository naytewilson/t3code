import { describe, expect, it } from "@effect/vitest";

import {
  buildCommandCodeAcpSpawnInput,
  COMMANDCODE_RESUME_VERSION,
  parseCommandCodeResume,
  resolveCommandCodeModeId,
} from "./CommandCodeAcpSupport.ts";

describe("parseCommandCodeResume", () => {
  it("accepts a well-formed cursor", () => {
    expect(
      parseCommandCodeResume({
        schemaVersion: 1,
        cmdSessionId: "  abc-123 ",
        host: "neo.local",
      }),
    ).toEqual({ schemaVersion: 1, cmdSessionId: "abc-123", host: "neo.local" });
  });

  it("rejects wrong versions, blanks, and non-records", () => {
    expect(parseCommandCodeResume(undefined)).toBeUndefined();
    expect(parseCommandCodeResume("abc")).toBeUndefined();
    expect(
      parseCommandCodeResume({ schemaVersion: 999, cmdSessionId: "a", host: "h" }),
    ).toBeUndefined();
    expect(
      parseCommandCodeResume({ schemaVersion: 1, cmdSessionId: "   ", host: "h" }),
    ).toBeUndefined();
    expect(
      parseCommandCodeResume({ schemaVersion: 1, cmdSessionId: "a", host: "" }),
    ).toBeUndefined();
    // A Cursor resume cursor must never parse as a Command Code cursor.
    expect(parseCommandCodeResume({ schemaVersion: 1, sessionId: "abc" })).toBeUndefined();
  });

  it("pins the current resume version", () => {
    expect(COMMANDCODE_RESUME_VERSION).toBe(1);
  });
});

describe("resolveCommandCodeModeId", () => {
  it("maps plan interaction to the plan bridge mode", () => {
    expect(resolveCommandCodeModeId({ interactionMode: "plan", runtimeMode: "full-access" })).toBe(
      "plan",
    );
  });

  it("never maps full-access to a yolo mode", () => {
    for (const runtimeMode of [
      "approval-required",
      "auto-accept-edits",
      "auto",
      "full-access",
    ] as const) {
      const mode = resolveCommandCodeModeId({ interactionMode: undefined, runtimeMode });
      expect(["default", "plan", "auto-accept"]).toContain(mode);
      expect(mode).not.toBe("yolo");
    }
    expect(
      resolveCommandCodeModeId({ interactionMode: undefined, runtimeMode: "full-access" }),
    ).toBe("auto-accept");
    expect(
      resolveCommandCodeModeId({ interactionMode: undefined, runtimeMode: "approval-required" }),
    ).toBe("default");
  });
});

describe("buildCommandCodeAcpSpawnInput", () => {
  it("defaults to commandcode-acp on PATH", () => {
    expect(buildCommandCodeAcpSpawnInput(null, "/tmp/project")).toEqual({
      command: "commandcode-acp",
      args: [],
      cwd: "/tmp/project",
    });
  });

  it("honors a configured binary path and environment", () => {
    expect(
      buildCommandCodeAcpSpawnInput({ binaryPath: "/opt/bin/commandcode-acp" }, "/tmp/project", {
        COMMANDCODE_BIN: "/usr/local/bin/cmd",
      }),
    ).toEqual({
      command: "/opt/bin/commandcode-acp",
      args: [],
      cwd: "/tmp/project",
      env: { COMMANDCODE_BIN: "/usr/local/bin/cmd" },
    });
  });

  it("falls back for blank binary paths", () => {
    expect(buildCommandCodeAcpSpawnInput({ binaryPath: "   " }, "/tmp/project").command).toBe(
      "commandcode-acp",
    );
  });
});
