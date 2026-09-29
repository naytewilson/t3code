import type { SessionConfigOption } from "@agentclientprotocol/sdk";

/** ACP session-config id for Muse's approval enforcement posture. */
export const APPROVAL_CONFIG_ID = "approval_mode";

/** Muse default: never call `session/setApprovalMode`, host posture untouched. */
export const APPROVAL_DEFAULT = "default";

/**
 * Closed approval vocabulary. Mirrors the official SDK `ApprovalMode`
 * (`@muse-code/sdk` `session/setApprovalMode`); keep in sync when upgrading it.
 * The host selects from modes its own configuration defines (select, never
 * create). There is deliberately no read-only/plan tier here: v0.3's exec
 * `--disable-write --disable-shell` posture has no serve-side equivalent, so
 * it is not advertised rather than approximated.
 */
export const APPROVAL_MODES = [
  "allowAll",
  "promptUnmatched",
  "onRequest",
  "denyUnmatched",
] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];
export const APPROVAL_VALUES = [APPROVAL_DEFAULT, ...APPROVAL_MODES] as const;
export type ApprovalValue = (typeof APPROVAL_VALUES)[number];

const NAMES: Record<ApprovalValue, string> = {
  default: "Muse default",
  allowAll: "Allow all",
  promptUnmatched: "Prompt on unmatched",
  onRequest: "On request",
  denyUnmatched: "Deny unmatched",
};

export function approvalConfigOption(current: string): SessionConfigOption {
  const safe: ApprovalValue = (APPROVAL_VALUES as readonly string[]).includes(current)
    ? (current as ApprovalValue)
    : APPROVAL_DEFAULT;
  return {
    id: APPROVAL_CONFIG_ID,
    name: "Approval mode",
    description:
      "Enforcement posture applied to Muse turns via session/setApprovalMode. Muse default never calls it and leaves the host untouched.",
    category: "_approval",
    type: "select",
    currentValue: safe,
    options: APPROVAL_VALUES.map((value) => ({ value, name: NAMES[value] })),
  };
}

/** Fail-closed: unknown values throw so the client sees an explicit error. */
export function parseApprovalValue(value: unknown): ApprovalValue {
  if (typeof value === "string" && (APPROVAL_VALUES as readonly string[]).includes(value)) {
    return value as ApprovalValue;
  }
  throw new Error(`Unknown ${APPROVAL_CONFIG_ID} value: ${JSON.stringify(value) ?? typeof value}`);
}

/** Map the stored session value to the MSP mode; default means never call. */
export function toMspApprovalMode(value: string): ApprovalMode | undefined {
  if (value === APPROVAL_DEFAULT) return undefined;
  if ((APPROVAL_MODES as readonly string[]).includes(value)) return value as ApprovalMode;
  return undefined;
}
