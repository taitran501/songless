import { z } from "zod"
import type { GameSessionMeta } from "@/lib/game-session"

const savedGameModalSchema = z.object({
  correct: z.boolean(),
  trackId: z.string().min(1),
  guesses: z.array(z.string()).max(6),
  trackIndex: z.number().int().nonnegative(),
  pointsEarned: z.number().int().nonnegative(),
})

export type SavedGameModal = z.infer<typeof savedGameModalSchema>

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function getGameModalStorageKey(session: Pick<GameSessionMeta, "runId">) {
  return `songless_modal_${session.runId}`
}

export function writeSavedGameModal(
  storage: StorageLike,
  session: Pick<GameSessionMeta, "runId">,
  modal: SavedGameModal
) {
  const parsed = savedGameModalSchema.parse(modal)
  storage.setItem(getGameModalStorageKey(session), JSON.stringify(parsed))
  return parsed
}

export function readSavedGameModal(
  storage: StorageLike,
  session: Pick<GameSessionMeta, "runId">
) {
  const key = getGameModalStorageKey(session)
  const raw = storage.getItem(key)
  if (!raw) return null

  try {
    const parsed = savedGameModalSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  } catch {
    // Corrupt modal checkpoints are cleared below.
  }

  storage.removeItem(key)
  return null
}

export function clearSavedGameModal(
  storage: StorageLike,
  session?: Pick<GameSessionMeta, "runId"> | null
) {
  if (session) storage.removeItem(getGameModalStorageKey(session))
}
