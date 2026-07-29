import { z } from "zod"

export const savedGameStateSchema = z.object({
  currentIndex: z.number().int().nonnegative(),
  currentStage: z.number().int().min(0).max(5),
  guesses: z.array(z.string()).max(6),
  score: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  solvedStageTotal: z.number().int().nonnegative(),
})

export type SavedGameState = z.infer<typeof savedGameStateSchema>

export const EMPTY_GAME_STATE: SavedGameState = {
  currentIndex: 0,
  currentStage: 0,
  guesses: [],
  score: 0,
  correctCount: 0,
  solvedStageTotal: 0,
}

export function parseSavedGameState(raw: string | null, trackCount: number): SavedGameState | null {
  if (!raw || trackCount <= 0) return null

  try {
    const parsed = savedGameStateSchema.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.currentIndex >= trackCount) return null
    return parsed.data
  } catch {
    return null
  }
}
