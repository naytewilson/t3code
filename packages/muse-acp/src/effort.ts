import type { SessionConfigOption } from "@agentclientprotocol/sdk";

/** ACP session-config id for Muse's per-turn reasoning tier. */
export const EFFORT_CONFIG_ID = "reasoning_effort";

/** Agent default: omit the tier and let `muse serve` decide per turn. */
export const EFFORT_DEFAULT = "default";

/**
 * Closed effort vocabulary. Mirrors the official SDK `ReasoningEffort` tiers
 * (`@muse-code/sdk` `turn/start` + `turn/steer`); keep in sync when upgrading it.
 * `none` is deliberately excluded: the meta provider rejects it
 * (`--reasoning-effort none is not supported with --provider meta`).
 */
export const EFFORT_TIERS = ["minimal", "low", "medium", "high", "xhigh", "ultra"] as const;
export type EffortTier = (typeof EFFORT_TIERS)[number];
export const EFFORT_VALUES = [EFFORT_DEFAULT, ...EFFORT_TIERS] as const;
export type EffortValue = (typeof EFFORT_VALUES)[number];

const NAMES: Record<EffortValue, string> = {
  default: "Agent default",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  ultra: "Ultra",
};

export function effortConfigOption(current: string): SessionConfigOption {
  const safe: EffortValue = (EFFORT_VALUES as readonly string[]).includes(current)
    ? (current as EffortValue)
    : EFFORT_DEFAULT;
  return {
    id: EFFORT_CONFIG_ID,
    name: "Reasoning effort",
    description:
      "Thinking tier sampled for each Muse turn. Agent default leaves the choice to Muse.",
    category: "thought_level",
    type: "select",
    currentValue: safe,
    options: EFFORT_VALUES.map((value) => ({ value, name: NAMES[value] })),
  };
}

/** Fail-closed: unknown values throw so the client sees an explicit error. */
export function parseEffortValue(value: unknown): EffortValue {
  if (typeof value === "string" && (EFFORT_VALUES as readonly string[]).includes(value)) {
    return value as EffortValue;
  }
  throw new Error(`Unknown ${EFFORT_CONFIG_ID} value: ${JSON.stringify(value) ?? typeof value}`);
}

/** Map the stored session value to the SDK turn tier; default means omit. */
export function toReasoningTier(value: string): EffortTier | undefined {
  if (value === EFFORT_DEFAULT) return undefined;
  if ((EFFORT_TIERS as readonly string[]).includes(value)) return value as EffortTier;
  return undefined;
}
