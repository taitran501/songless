import { createHash } from "node:crypto"
import { z } from "zod"
import { isValidDateKey } from "@/lib/date-key"
import {
  hasApprovedAudioStart,
  hasPlayableAudioSource,
  isYoutubeTrack,
  type GameTrack,
  type GenreEvidenceSource,
} from "@/lib/tracks"

export const DAILY_SNAPSHOT_VERSION = 1 as const
export const DAILY_SNAPSHOT_TTL_SECONDS = 400 * 24 * 60 * 60
export const DAILY_SNAPSHOT_KEY_PREFIX = "songless:daily:v1:"
export const DAILY_SNAPSHOT_LOCK_PREFIX = "songless:daily:lock:v1:"

const TRACK_GENRES = ["vpop", "usuk", "rap"] as const
const DAILY_SOURCE_TYPES = ["official_audio", "lyric_video", "music_video"] as const

const snapshotTrackSchema = z.object({
  // Schema v1 is intentionally unchanged for old snapshots. Runtime
  // invariants below only publish/accept YouTube tracks going forward.
  source: z.enum(["spotify", "youtube"]),
  uri: z.string().min(1),
  videoId: z.string().min(1).optional(),
  name: z.string().min(1),
  artists: z.string().min(1),
  duration_ms: z.number().finite().nonnegative(),
  albumImage: z.string().nullable(),
  preview_url: z.string().nullable(),
  genre: z.enum(TRACK_GENRES),
  genreEvidence: z.enum(["provider", "allowlist"]),
  genreConfidence: z.number().finite().min(0).max(1).optional(),
  lyricsSnippets: z.array(z.string()).optional(),
  challengeId: z.string().min(1).optional(),
  dailyEligible: z.literal(true),
  audioStartSeconds: z.number().finite().nonnegative(),
  audioFirstManifest: z.boolean().optional(),
  sourceType: z.enum(DAILY_SOURCE_TYPES),
  audioAnalysisStatus: z.literal("approved"),
  audioStartConfidence: z.number().finite().min(0).max(1).optional(),
}).strict()

const dailySnapshotSchema = z.object({
  schemaVersion: z.literal(DAILY_SNAPSHOT_VERSION),
  dateKey: z.string().refine(isValidDateKey, "dateKey must be a valid UTC calendar date"),
  generatedAt: z.string().datetime(),
  source: z.enum(["live", "curated", "mixed"]),
  tracks: z.array(snapshotTrackSchema).length(3),
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict()

export type DailySnapshotTrack = z.infer<typeof snapshotTrackSchema>
export type DailySnapshot = z.infer<typeof dailySnapshotSchema>

export class DailySnapshotValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DailySnapshotValidationError"
  }
}

export function getDailySnapshotKey(dateKey: string) {
  return `${DAILY_SNAPSHOT_KEY_PREFIX}${dateKey}`
}

export function getDailySnapshotLockKey(dateKey: string) {
  return `${DAILY_SNAPSHOT_LOCK_PREFIX}${dateKey}`
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, stableValue(entry)])
  )
}

export function stableStringify(value: unknown) {
  return JSON.stringify(stableValue(value))
}

function checksumPayload(snapshot: Omit<DailySnapshot, "checksum">) {
  return createHash("sha256")
    .update(stableStringify(snapshot))
    .digest("hex")
}

export function getDailyTrackId(track: Pick<GameTrack, "challengeId" | "uri">) {
  return track.challengeId || track.uri
}

export function assertDailyTracks(tracks: readonly GameTrack[]) {
  if (tracks.length !== 3) {
    throw new DailySnapshotValidationError("Daily snapshot must contain exactly three tracks.")
  }

  const ids = tracks.map(getDailyTrackId)
  if (new Set(ids).size !== ids.length) {
    throw new DailySnapshotValidationError("Daily snapshot contains duplicate tracks.")
  }
  const uris = tracks.map((track) => track.uri)
  if (new Set(uris).size !== uris.length) {
    throw new DailySnapshotValidationError("Daily snapshot contains duplicate track URIs.")
  }

  const genres = tracks.map((track) => track.genre)
  if (
    new Set(genres).size !== 3 ||
    !TRACK_GENRES.every((genre) => genres.includes(genre))
  ) {
    throw new DailySnapshotValidationError("Daily snapshot must contain one vpop, usuk, and rap track.")
  }

  for (const track of tracks) {
    if (!isYoutubeTrack(track)) {
      throw new DailySnapshotValidationError(`Track ${getDailyTrackId(track)} is not a YouTube source.`)
    }
    if (!hasPlayableAudioSource(track)) {
      throw new DailySnapshotValidationError(`Track ${getDailyTrackId(track)} has no playable audio source.`)
    }
    if (track.genreEvidence !== "provider" && track.genreEvidence !== "allowlist") {
      throw new DailySnapshotValidationError(`Track ${getDailyTrackId(track)} has no genre evidence.`)
    }
    if (track.dailyEligible !== true) {
      throw new DailySnapshotValidationError(`Track ${getDailyTrackId(track)} is not eligible for Daily.`)
    }
    if (track.audioAnalysisStatus !== "approved") {
      throw new DailySnapshotValidationError(`Track ${getDailyTrackId(track)} has no approved audio analysis.`)
    }
    if (!hasApprovedAudioStart(track)) {
      throw new DailySnapshotValidationError(`Track ${getDailyTrackId(track)} has no valid audio start.`)
    }
    if (!track.sourceType || !DAILY_SOURCE_TYPES.includes(track.sourceType as (typeof DAILY_SOURCE_TYPES)[number])) {
      throw new DailySnapshotValidationError(`Track ${getDailyTrackId(track)} has an unverified source type.`)
    }
  }
}

export function createDailySnapshot(input: {
  dateKey: string
  tracks: readonly GameTrack[]
  source: DailySnapshot["source"]
  generatedAt?: string
}) {
  assertDailyTracks(input.tracks)
  const generatedAt = input.generatedAt || new Date().toISOString()
  const candidate = {
    schemaVersion: DAILY_SNAPSHOT_VERSION,
    dateKey: input.dateKey,
    generatedAt,
    source: input.source,
    tracks: input.tracks,
  }
  const parsed = dailySnapshotSchema
    .omit({ checksum: true })
    .safeParse(candidate)
  if (!parsed.success) {
    throw new DailySnapshotValidationError(parsed.error.message)
  }

  const snapshot = {
    ...parsed.data,
    checksum: `sha256:${checksumPayload(parsed.data)}`,
  }
  return dailySnapshotSchema.parse(snapshot)
}

export function parseDailySnapshot(raw: unknown): DailySnapshot {
  let value = raw
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw)
    } catch {
      throw new DailySnapshotValidationError("Daily snapshot is not valid JSON.")
    }
  }

  const parsed = dailySnapshotSchema.safeParse(value)
  if (!parsed.success) {
    throw new DailySnapshotValidationError(parsed.error.message)
  }

  const { checksum, ...withoutChecksum } = parsed.data
  const expectedChecksum = `sha256:${checksumPayload(withoutChecksum)}`
  if (checksum !== expectedChecksum) {
    throw new DailySnapshotValidationError("Daily snapshot checksum does not match its payload.")
  }

  assertDailyTracks(parsed.data.tracks)
  return parsed.data
}

export interface DailySnapshotStore {
  get(dateKey: string): Promise<DailySnapshot | null>
  putIfAbsent(snapshot: DailySnapshot): Promise<boolean>
  acquireLock(dateKey: string, ttlSeconds: number): Promise<string | null>
  releaseLock(dateKey: string, token: string): Promise<void>
}

export type DailyGenreEvidence = GenreEvidenceSource
