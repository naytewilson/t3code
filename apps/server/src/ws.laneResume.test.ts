import { describe, expect, it } from "vite-plus/test";

import { shouldResumeLaneWithSnapshot } from "./laneResume.ts";

describe("shouldResumeLaneWithSnapshot", () => {
  it("uses a snapshot when the cursor is behind by more than the max gap", () => {
    expect(shouldResumeLaneWithSnapshot(2_000, 500, 1_000)).toBe(true);
  });

  it("replays events when the gap is within the bound", () => {
    expect(shouldResumeLaneWithSnapshot(1_500, 500, 1_000)).toBe(false);
  });

  it("uses a snapshot when the cursor is ahead of head", () => {
    expect(shouldResumeLaneWithSnapshot(10, 20, 1_000)).toBe(true);
  });
});
