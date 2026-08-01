import { describe, expect, it } from "@effect/vitest";
import * as Schema from "effect/Schema";

import { CheckStatus } from "./completionGate.ts";

const CANONICAL_CHECK_STATUSES = [
  "not-run",
  "running",
  "passed",
  "failed",
  "skipped-with-reason",
  "blocked",
  "stale",
  "superseded",
] as const;

describe("CheckStatus (H01)", () => {
  it("accepts every canonical product status and rejects synonyms", () => {
    for (const status of CANONICAL_CHECK_STATUSES) {
      expect(Schema.decodeUnknownSync(CheckStatus)(status)).toBe(status);
    }
    expect(() => Schema.decodeUnknownSync(CheckStatus)("success")).toThrow();
    expect(() => Schema.decodeUnknownSync(CheckStatus)("skipped")).toThrow();
    expect(() => Schema.decodeUnknownSync(CheckStatus)("done")).toThrow();
  });
});
