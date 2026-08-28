import {
  assertDailyTracks,
  createDailySnapshot,
  type DailySnapshot,
  type DailySnapshotStore,
} from "@/lib/daily-snapshot"
import {
  DailySnapshotStoreUnavailableError,
  getDailySnapshotStore,
} from "@/lib/daily-snapshot-redis"
import { fetchAllLiveCharts, type PublicChartTrack } from "@/lib/public-charts"
import { resolveLiveTrackToGameTrack } from "@/lib/live-track-resolver"
import { CURATED_TRACKS, getUtcDateKey, selectDailyTracks } from "@/lib/curated-tracks"
import { hasApprovedAudioStart, type GameTrack, type TrackGenre } from "@/lib/tracks"
import { recordDailyMetric } from "@/lib/daily-observability"
import { isValidDateKey } from "@/lib/date-key"

const DAILY_GENRES: TrackGenre[] = ["vpop", "usuk", "rap"]
const LIVE_CANDIDATE_LIMIT = 4
const DAILY_LOCK_TTL_SECONDS = 60
const SNAPSHOT_WAIT_DELAYS_MS = [100, 250, 500, 750]

export type DailyTrackGenerator = (dateKey: string) => Promise<GameTrack[]>

export class DailySnapshotUnavailableError extends Error {
  constructor(message = "Today's Daily challenge is temporarily unavailable.") {
    super(message)
    this.name = "DailySnapshotUnavailableError"
  }
}

function hasApprovedAudioMetadata(track: PublicChartTrack) {
  return hasApprovedAudioStart(track)
}

function getTrackId(track: GameTrack) {
  return track.challengeId || track.uri
}

function isCuratedTrack(track: GameTrack) {
  const id = getTrackId(track)
  return CURATED_TRACKS.some((candidate) => getTrackId(candidate) === id)
}

function getSnapshotSource(tracks: readonly GameTrack[]): DailySnapshot["source"] {
  const curated = tracks.filter(isCuratedTrack).length
  if (curated === tracks.length) return "curated"
  if (curated === 0) return "live"
  return "mixed"
}

async function resolveLiveCandidate(
  candidate: PublicChartTrack,
  dateKey: string,
  genre: TrackGenre
) {
  // A live chart entry without an approved audio-start manifest is discovery
  // data only. It must never silently become a Daily-ready track at t=0.
  if (!hasApprovedAudioMetadata(candidate)) return null

  const resolved = await resolveLiveTrackToGameTrack(
    candidate,
    `daily-${dateKey}-${genre}`
  )
  if (!resolved || resolved.genre !== genre || !resolved.dailyEligible) return null
  return resolved
}

/**
 * Builds a validated Daily set without touching durable storage. Live entries
 * are used only when genre, YouTube source, and audio-start metadata are all
 * approved; otherwise the deterministic curated catalog supplies the slot.
 */
export async function generateLiveDailyTracks(dateKey: string): Promise<GameTrack[]> {
  const liveCharts = await fetchAllLiveCharts()
  const curatedTracks = selectDailyTracks(dateKey)
  const selected = await Promise.all(DAILY_GENRES.map(async (genre) => {
    const liveCandidates = (liveCharts[genre] || []).slice(0, LIVE_CANDIDATE_LIMIT)
    const approvedCandidates = liveCandidates.filter(hasApprovedAudioMetadata)
    const rejectedAudioCandidates = liveCandidates.length - approvedCandidates.length
    const resolvedCandidates = await Promise.all(
      approvedCandidates.map(async (candidate) => {
        try {
          return await resolveLiveCandidate(candidate, dateKey, genre)
        } catch (error) {
          console.warn(`[Daily] Could not resolve ${genre} candidate ${candidate.id}:`, error)
          return null
        }
      })
    )
    const selectedTrack =
      resolvedCandidates.find((track): track is GameTrack => track !== null) || null
    const rejectedResolvedCandidates = resolvedCandidates.filter((track) => track === null).length

    const curatedFallback = curatedTracks.find((track) => track.genre === genre)
    recordDailyMetric("candidate_filter", {
      dateKey,
      genre,
      chartCandidates: liveCandidates.length,
      rejectedAudioCandidates,
      rejectedResolvedCandidates,
      usedCuratedFallback: !selectedTrack,
    })
    return selectedTrack || curatedFallback || (() => {
      throw new DailySnapshotUnavailableError(
        `No approved ${genre} track is available for ${dateKey}.`
      )
    })()
  }))

  try {
    assertDailyTracks(selected)
  } catch (error) {
    throw new DailySnapshotUnavailableError(
      error instanceof Error ? error.message : "Generated Daily tracks are invalid."
    )
  }
  return selected
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function assertSnapshotDate(snapshot: DailySnapshot, dateKey: string) {
  if (snapshot.dateKey !== dateKey) {
    throw new DailySnapshotUnavailableError("Daily snapshot date does not match the requested date.")
  }
  return snapshot
}

async function waitForPublishedSnapshot(
  dateKey: string,
  store: DailySnapshotStore
) {
  for (const delay of SNAPSHOT_WAIT_DELAYS_MS) {
    await wait(delay)
    const snapshot = await store.get(dateKey)
    if (snapshot) return snapshot
  }
  return null
}

export async function publishDailySnapshot(
  dateKey: string,
  store: DailySnapshotStore = getDailySnapshotStore(),
  generate: DailyTrackGenerator = generateLiveDailyTracks
) {
  if (!isValidDateKey(dateKey)) {
    throw new DailySnapshotUnavailableError("Daily snapshot date is invalid.")
  }
  const startedAt = Date.now()
  const existing = await store.get(dateKey)
  if (existing) {
    assertSnapshotDate(existing, dateKey)
    recordDailyMetric("snapshot_hit", { dateKey })
    return { snapshot: existing, created: false }
  }

  const lockToken = await store.acquireLock(dateKey, DAILY_LOCK_TTL_SECONDS)
  if (!lockToken) {
    const published = await waitForPublishedSnapshot(dateKey, store)
    if (published) return { snapshot: assertSnapshotDate(published, dateKey), created: false }
    throw new DailySnapshotUnavailableError("Daily generation is already in progress.")
  }

  try {
    const alreadyPublished = await store.get(dateKey)
    if (alreadyPublished) {
      assertSnapshotDate(alreadyPublished, dateKey)
      recordDailyMetric("snapshot_hit_after_lock", { dateKey })
      return { snapshot: alreadyPublished, created: false }
    }

    const tracks = await generate(dateKey)
    const snapshot = createDailySnapshot({
      dateKey,
      tracks,
      source: getSnapshotSource(tracks),
    })
    const created = await store.putIfAbsent(snapshot)
    if (created) {
      recordDailyMetric("snapshot_published", {
        dateKey,
        durationMs: Date.now() - startedAt,
        trackCount: snapshot.tracks.length,
      })
      return { snapshot, created: true }
    }

    const winner = await store.get(dateKey)
    if (winner) {
      assertSnapshotDate(winner, dateKey)
      recordDailyMetric("snapshot_race_lost", { dateKey })
      return { snapshot: winner, created: false }
    }
    throw new DailySnapshotUnavailableError("Daily snapshot was not published.")
  } catch (error) {
    if (error instanceof DailySnapshotUnavailableError) throw error
    if (error instanceof DailySnapshotStoreUnavailableError) throw error
    throw new DailySnapshotUnavailableError(
      error instanceof Error ? error.message : "Daily generation failed."
    )
  } finally {
    try {
      await store.releaseLock(dateKey, lockToken)
    } catch (error) {
      console.warn("[Daily] Could not release generation lock:", error)
    }
  }
}

export async function getOrGenerateDailySnapshot(
  dateKey = getUtcDateKey(),
  store: DailySnapshotStore = getDailySnapshotStore(),
  generate: DailyTrackGenerator = generateLiveDailyTracks
) {
  try {
    if (!isValidDateKey(dateKey)) {
      throw new DailySnapshotUnavailableError("Daily snapshot date is invalid.")
    }
    const existing = await store.get(dateKey)
    if (existing) {
      const snapshot = assertSnapshotDate(existing, dateKey)
      recordDailyMetric("snapshot_hit", { dateKey })
      return snapshot
    }
    recordDailyMetric("snapshot_miss", { dateKey })
    return (await publishDailySnapshot(dateKey, store, generate)).snapshot
  } catch (error) {
    if (
      error instanceof DailySnapshotUnavailableError ||
      error instanceof DailySnapshotStoreUnavailableError
    ) {
      throw error
    }
    throw new DailySnapshotUnavailableError(
      error instanceof Error ? error.message : "Daily snapshot is unavailable."
    )
  }
}
