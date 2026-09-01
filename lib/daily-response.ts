import { z } from "zod"
import { isValidDateKey } from "@/lib/date-key"
import { getTrackResultId } from "@/lib/game-state"
import {
  hasApprovedAudioStart,
  hasPlayableAudioSource,
  normalizeTracks,
  isYoutubeTrack,
  type GameTrack,
} from "@/lib/tracks"

const dailyTrackContractSchema = z.object({
  source: z.enum(["spotify", "youtube"]),
  uri: z.string().min(1),
  videoId: z.string().min(1).optional(),
  name: z.string().min(1),
  artists: z.string().min(1),
  duration_ms: z.number().finite().nonnegative(),
  albumImage: z.string().nullable(),
  preview_url: z.string().nullable(),
  genre: z.enum(["vpop", "usuk", "rap"]),
  genreEvidence: z.enum(["provider", "allowlist"]),
  genreConfidence: z.number().finite().min(0).max(1).optional(),
  challengeId: z.string().min(1).optional(),
  lyricsSnippets: z.array(z.string()).optional(),
  dailyEligible: z.literal(true),
  audioStartSeconds: z.number().finite().nonnegative(),
  audioFirstManifest: z.boolean().optional(),
  sourceType: z.enum(["official_audio", "lyric_video", "music_video"]),
  audioAnalysisStatus: z.literal("approved"),
  audioStartConfidence: z.number().finite().min(0).max(1).optional(),
})

const dailyResponseSchema = z.object({
  dateKey: z.string().refine(isValidDateKey, "dateKey must be a valid UTC calendar date"),
  snapshotVersion: z.literal(1),
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  tracks: z.array(dailyTrackContractSchema),
})

export class DailyResponseValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DailyResponseValidationError"
  }
}

export function parseDailyResponse(value: unknown, expectedDateKey: string): GameTrack[] {
  const parsed = dailyResponseSchema.safeParse(value)
  if (!parsed.success) {
    throw new DailyResponseValidationError(
      "Today's challenge response is invalid or contains an unverified track."
    )
  }
  if (parsed.data.dateKey !== expectedDateKey) {
    throw new DailyResponseValidationError("Today's challenge returned the wrong date.")
  }

  const tracks = normalizeTracks(parsed.data.tracks)
  if (tracks.length !== 3) {
    throw new DailyResponseValidationError("Today's challenge did not return three playable tracks.")
  }

  const ids = tracks.map(getTrackResultId)
  const uris = tracks.map((track) => track.uri)
  const genres = tracks.map((track) => track.genre)
  if (
    new Set(ids).size !== 3 ||
    new Set(uris).size !== 3 ||
    new Set(genres).size !== 3 ||
    !(["vpop", "usuk", "rap"] as const).every((genre) => genres.includes(genre))
  ) {
    throw new DailyResponseValidationError("Today's challenge has invalid genre slots.")
  }

  if (
    tracks.some(
      (track) =>
        track.dailyEligible !== true ||
        !isYoutubeTrack(track) ||
        !hasPlayableAudioSource(track) ||
        !track.genreEvidence ||
        track.audioAnalysisStatus !== "approved" ||
        !hasApprovedAudioStart(track) ||
        !["official_audio", "lyric_video", "music_video"].includes(track.sourceType || "")
    )
  ) {
    throw new DailyResponseValidationError("Today's challenge contains an unverified audio source.")
  }

  return tracks
}
