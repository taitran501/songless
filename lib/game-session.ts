import { z } from "zod"
import type { GameMode, TrackGenre } from "@/lib/tracks"

export const GAME_SESSION_STORAGE_KEY = "songless_session_v2"
export const LEGACY_GAME_MODE_STORAGE_KEY = "songless_game_mode"
export const LEGACY_DAILY_DATE_STORAGE_KEY = "songless_daily_date"
export const LEGACY_PLAYLIST_ID_STORAGE_KEY = "current_playlist_id"

const gameSessionSchema = z.object({
  kind: z.enum(["daily", "lyrics", "playlist", "genre"]),
  playbackMode: z.enum(["audio", "lyrics"]),
  id: z.string().min(1),
  runId: z.string().min(1),
  status: z.enum(["active", "completed"]).default("active"),
  startedAt: z.string().datetime().optional(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  genre: z.enum(["usuk", "vpop", "rap"]).optional(),
  playlistSource: z.enum(["spotify", "youtube"]).optional(),
})

export type GameSessionKind = z.infer<typeof gameSessionSchema>["kind"]
export type GameSessionStatus = z.infer<typeof gameSessionSchema>["status"]
export type GameSessionMeta = z.infer<typeof gameSessionSchema>
export type GameSessionInput = Omit<GameSessionMeta, "runId" | "status"> & {
  runId?: string
  status?: GameSessionStatus
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export function createRunId(prefix = "run") {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${randomPart}`
}

export function createGameSession(
  input: GameSessionInput
): GameSessionMeta {
  return gameSessionSchema.parse({
    ...input,
    runId: input.runId ?? createRunId(input.kind),
    status: input.status ?? "active",
    startedAt: input.startedAt ?? new Date().toISOString(),
  })
}

function clearLegacySessionKeys(storage: StorageLike) {
  storage.removeItem(LEGACY_GAME_MODE_STORAGE_KEY)
  storage.removeItem(LEGACY_DAILY_DATE_STORAGE_KEY)
  storage.removeItem(LEGACY_PLAYLIST_ID_STORAGE_KEY)
}

export function writeGameSession(storage: StorageLike, session: GameSessionInput) {
  const parsed = gameSessionSchema.parse(session)
  storage.setItem(GAME_SESSION_STORAGE_KEY, JSON.stringify(parsed))
  clearLegacySessionKeys(storage)
  return parsed
}

function inferPlaylistSource(id: string): GameSessionMeta["playlistSource"] {
  return id.includes("youtube") || id.includes("youtu.be") ? "youtube" : undefined
}

export function migrateLegacyGameSession(storage: StorageLike): GameSessionMeta | null {
  const legacyId = storage.getItem(LEGACY_PLAYLIST_ID_STORAGE_KEY)
  const legacyMode = storage.getItem(LEGACY_GAME_MODE_STORAGE_KEY)
  const legacyDate = storage.getItem(LEGACY_DAILY_DATE_STORAGE_KEY)
  const hasTracks = Boolean(storage.getItem("game_tracks"))

  if (!legacyId && !legacyMode && !legacyDate && !hasTracks) return null

  const playbackMode: GameMode = legacyMode === "lyrics" ? "lyrics" : "audio"
  const kind: GameSessionKind = legacyDate ? "daily" : playbackMode === "lyrics" ? "lyrics" : "playlist"
  const id = legacyId || (kind === "lyrics" ? "lyrics-curated-v1" : "legacy-playlist")
  const runId = `legacy-${id}`
  const session = createGameSession({
    kind,
    playbackMode,
    id,
    runId,
    ...(legacyDate ? { dateKey: legacyDate } : {}),
    ...(kind === "playlist" ? { playlistSource: inferPlaylistSource(id) } : {}),
  })

  const legacyStateKey = `songless_state_${id}`
  const nextStateKey = getGameStateStorageKey(session)
  const legacyState = storage.getItem(legacyStateKey)
  if (legacyState && legacyStateKey !== nextStateKey && !storage.getItem(nextStateKey)) {
    storage.setItem(nextStateKey, legacyState)
    storage.removeItem(legacyStateKey)
  }

  return writeGameSession(storage, session)
}

export function readGameSession(storage: StorageLike): GameSessionMeta | null {
  const raw = storage.getItem(GAME_SESSION_STORAGE_KEY)
  if (raw) {
    try {
      const parsed = gameSessionSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
    } catch {
      // Invalid JSON is handled by removing the corrupt value below.
    }
    storage.removeItem(GAME_SESSION_STORAGE_KEY)
  }

  return migrateLegacyGameSession(storage)
}

export function getGameStateStorageKey(session: Pick<GameSessionMeta, "runId">) {
  return `songless_state_${session.runId}`
}

export function clearGameSession(storage: StorageLike, session?: GameSessionMeta | null) {
  const activeSession = session ?? readGameSession(storage)
  if (activeSession) {
    storage.removeItem(getGameStateStorageKey(activeSession))
    storage.removeItem(`songless_state_${activeSession.id}`)
  }
  storage.removeItem(GAME_SESSION_STORAGE_KEY)
  storage.removeItem("game_tracks")
  clearLegacySessionKeys(storage)
}

export function isGenreSession(
  session: GameSessionMeta | null
): session is GameSessionMeta & { kind: "genre"; genre: TrackGenre } {
  return session?.kind === "genre" && Boolean(session.genre)
}
