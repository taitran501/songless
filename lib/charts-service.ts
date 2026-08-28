import { generateLiveDailyTracks } from "@/lib/dynamic-daily-service"
import type { GameTrack } from "@/lib/tracks"

export type DifficultyTier = "easy" | "medium" | "hard"

/** @deprecated Daily no longer publishes tiered chart candidates. */
export interface TieredTrack extends GameTrack {
  tier: DifficultyTier
  chartRank: number
}

/**
 * Backward-compatible entrypoint for callers that used the old charts service.
 * Daily generation now has one authoritative implementation and one snapshot
 * publication path in dynamic-daily-service.ts.
 */
export async function getLiveDailyChallenge(dateKey: string): Promise<GameTrack[]> {
  return generateLiveDailyTracks(dateKey)
}
