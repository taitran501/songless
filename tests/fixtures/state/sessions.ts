export type FixtureSessionInput = {
  kind: "daily" | "lyrics" | "playlist" | "genre"
  playbackMode: "audio" | "lyrics"
  id: string
  runId?: string
  status?: "active" | "completed"
  startedAt?: string
  dateKey?: string
  genre?: "usuk" | "vpop" | "rap"
  playlistSource?: "spotify" | "youtube"
}

export type FixtureSavedState = {
  currentIndex: number
  currentStage: number
  guesses: string[]
  score: number
  correctCount: number
  solvedStageTotal: number
  currentStreak: number
  bestRunStreak: number
  trackResults: unknown[]
}

export const initialGameState: FixtureSavedState = {
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

export const activePlaylistSession: FixtureSessionInput = {
  kind: "playlist",
  playbackMode: "audio",
  id: "playlist-fixture",
  runId: "playlist-fixture-run",
  playlistSource: "spotify",
  startedAt: "2026-08-27T00:00:00.000Z",
}

export const activeDailySession: FixtureSessionInput = {
  kind: "daily",
  playbackMode: "audio",
  id: "daily-audio-2026-08-27",
  runId: "daily-fixture-run",
  dateKey: "2026-08-27",
  startedAt: "2026-08-27T00:00:00.000Z",
}

export const activeLyricsSession: FixtureSessionInput = {
  kind: "lyrics",
  playbackMode: "lyrics",
  id: "lyrics-fixture",
  runId: "lyrics-fixture-run",
  startedAt: "2026-08-27T00:00:00.000Z",
}

export const activeGenreSession: FixtureSessionInput = {
  kind: "genre",
  playbackMode: "audio",
  id: "genre-vpop",
  runId: "genre-fixture-run",
  genre: "vpop",
  startedAt: "2026-08-27T00:00:00.000Z",
}
