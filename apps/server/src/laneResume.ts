/** Default bound matching SHELL_RESUME_MAX_GAP / event-store page size. */
export const LANE_RESUME_MAX_GAP = 1_000;

/** Prefer a detail snapshot when the resume cursor is missing or too far behind. */
export function shouldResumeLaneWithSnapshot(
  latestSequence: number,
  afterSequence: number,
  maxGap: number = LANE_RESUME_MAX_GAP,
): boolean {
  const replayGap = latestSequence - afterSequence;
  return replayGap < 0 || replayGap > maxGap;
}
