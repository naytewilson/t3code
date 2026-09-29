import { describe, expect, it } from "vite-plus/test";

import {
  APPROVAL_CONFIG_ID,
  APPROVAL_DEFAULT,
  approvalConfigOption,
  parseApprovalValue,
  toMspApprovalMode,
} from "../src/approval.js";

describe("muse approval mode", () => {
  it("advertises an approval select option defaulting to Muse default", () => {
    expect(approvalConfigOption(APPROVAL_DEFAULT)).toMatchObject({
      id: APPROVAL_CONFIG_ID,
      type: "select",
      currentValue: "default",
    });
    const option = approvalConfigOption(APPROVAL_DEFAULT);
    if (option.type !== "select") throw new Error("expected select option");
    expect(option.options.map((entry) => ("value" in entry ? entry.value : null))).toEqual([
      "default",
      "allowAll",
      "promptUnmatched",
      "onRequest",
      "denyUnmatched",
    ]);
  });

  it("accepts every advertised value and rejects unknown values closed", () => {
    for (const value of [
      "default",
      "allowAll",
      "promptUnmatched",
      "onRequest",
      "denyUnmatched",
    ] as const) {
      expect(parseApprovalValue(value)).toBe(value);
    }
    expect(() => parseApprovalValue("auto-accept")).toThrow();
    expect(() => parseApprovalValue(undefined)).toThrow();
  });

  it("never calls setApprovalMode on default and forwards exact modes otherwise", () => {
    expect(toMspApprovalMode("default")).toBeUndefined();
    expect(toMspApprovalMode("allowAll")).toBe("allowAll");
    expect(toMspApprovalMode("denyUnmatched")).toBe("denyUnmatched");
    expect(toMspApprovalMode("bogus")).toBeUndefined();
  });
});
