import { z } from "zod"

export const attemptOutcomeSchema = z.enum(["wrong", "skip", "correct"])
export type AttemptOutcome = z.infer<typeof attemptOutcomeSchema>

export const trackRunResultSchema = z.object({
  trackId: z.string().min(1),
  status: z.enum(["solved", "failed", "unknown"]),
  attempts: z.array(attemptOutcomeSchema).max(6),
  completedStage: z.number().int().min(0).max(5).nullable(),
  points: z.number().int().nonnegative(),
})

export type TrackRunResult = z.infer<typeof trackRunResultSchema>

export const savedGameStateSchema = z.object({
  currentIndex: z.number().int().nonnegative(),
  currentStage: z.number().int().min(0).max(5),
  guesses: z.array(z.string()).max(6),
  score: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  solvedStageTotal: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative().default(0),
  bestRunStreak: z.number().int().nonnegative().default(0),
  trackResults: z.array(trackRunResultSchema).default([]),
})

export type SavedGameState = z.infer<typeof savedGameStateSchema>

export const EMPTY_GAME_STATE: SavedGameState = {
  currentIndex: 0,
  currentStage: 0,
  guesses: [],
  score: 0,
  correctCount: 0,
  solvedStageTotal: 0,
  currentStreak: 0,
  bestRunStreak: 0,
  trackResults: [],
}

function createLegacyResults(
  resultCount: number,
  trackIds: readonly string[]
): TrackRunResult[] {
  return Array.from({ length: resultCount }, (_, index) => ({
    trackId: trackIds[index] || `legacy-track-${index + 1}`,
    status: "unknown" as const,
    attempts: [],
    completedStage: null,
    points: 0,
  }))
}

export function parseSavedGameState(
  raw: string | null,
  trackCount: number,
  trackIds: readonly string[] = []
): SavedGameState | null {
  if (!raw || trackCount <= 0) return null

  try {
    const parsed = savedGameStateSchema.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.currentIndex >= trackCount) return null
    if (parsed.data.trackResults.length > trackCount) return null

    const uniqueTrackIds = new Set(parsed.data.trackResults.map((result) => result.trackId))
    if (uniqueTrackIds.size !== parsed.data.trackResults.length) return null

    const completedBeforeCurrent = Math.min(parsed.data.currentIndex, trackCount)
    if (parsed.data.trackResults.length >= completedBeforeCurrent) return parsed.data

    return {
      ...parsed.data,
      trackResults: [
        ...parsed.data.trackResults,
        ...createLegacyResults(
          completedBeforeCurrent - parsed.data.trackResults.length,
          trackIds.slice(parsed.data.trackResults.length)
        ),
      ],
    }
  } catch {
    return null
  }
}

export function getTrackResultId(track: { challengeId?: string; uri: string }) {
  return track.challengeId || track.uri
}

export function buildTrackRunResult(input: {
  trackId: string
  guesses: readonly string[]
  solved: boolean
  completedStage: number
  points: number
}): TrackRunResult {
  const attempts = input.guesses.slice(0, 6).map<AttemptOutcome>((guess, index, values) => {
    if (input.solved && index === values.length - 1) return "correct"
    return guess === "SKIPPED" ? "skip" : "wrong"
  })

  return trackRunResultSchema.parse({
    trackId: input.trackId,
    status: input.solved ? "solved" : "failed",
    attempts,
    completedStage: input.completedStage,
    points: input.points,
  })
}

export function appendTrackResult(
  results: readonly TrackRunResult[],
  result: TrackRunResult
) {
  if (results.some((existing) => existing.trackId === result.trackId)) {
    return [...results]
  }
  return [...results, result]
}
