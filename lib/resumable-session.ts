import {
  clearGameSession,
  getGameStateStorageKey,
  readGameSession,
  type GameSessionMeta,
} from "@/lib/game-session"
import {
  getTrackResultId,
  parseSavedGameState,
  type SavedGameState,
} from "@/lib/game-state"
import { normalizeTracks, type GameTrack } from "@/lib/tracks"

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export interface ResumableGameSession {
  session: GameSessionMeta
  tracks: GameTrack[]
  state: SavedGameState
}

export function readResumableGameSession(
  storage: StorageLike
): ResumableGameSession | null {
  const session = readGameSession(storage)
  if (!session) return null

  const rawTracks = storage.getItem("game_tracks")
  if (!rawTracks) return null

  let tracks: GameTrack[]
  try {
    tracks = normalizeTracks(JSON.parse(rawTracks))
  } catch {
    clearGameSession(storage, session)
    return null
  }
  if (tracks.length === 0) {
    clearGameSession(storage, session)
    return null
  }

  const stateKey = getGameStateStorageKey(session)
  const rawState = storage.getItem(stateKey)
  if (!rawState) return null

  const state = parseSavedGameState(
    rawState,
    tracks.length,
    tracks.map(getTrackResultId)
  )
  if (!state || state.trackResults.length >= tracks.length) {
    clearGameSession(storage, session)
    return null
  }

  return { session, tracks, state }
}

export function discardResumableGameSession(
  storage: StorageLike,
  resumable: ResumableGameSession
) {
  clearGameSession(storage, resumable.session)
}
