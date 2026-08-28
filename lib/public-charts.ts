import { classifyChartGenre } from "@/lib/genre-taxonomy"
import type { AudioAnalysisStatus, GenreEvidenceSource, TrackGenre } from "@/lib/tracks"

export interface PublicChartTrack {
  id: string
  name: string
  artists: string
  albumImage: string | null
  previewUrl: string | null
  region: "vn" | "us"
  rank: number
  genre?: TrackGenre
  genreEvidence?: GenreEvidenceSource
  genreConfidence?: number
  providerGenres?: string[]
  audioStartSeconds?: number
  audioFirstManifest?: boolean
  audioAnalysisStatus?: AudioAnalysisStatus
  audioStartConfidence?: number
}

export type LiveChartBuckets = Record<TrackGenre, PublicChartTrack[]>

// In-memory cache only avoids duplicate upstream requests in one process. It is
// deliberately not used for Daily challenge state; snapshots live in Redis.
const chartsCache = new Map<string, { data: PublicChartTrack[]; fetchedAt: number }>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function readProviderGenres(item: any): string[] | undefined {
  const rawValues = [
    item?.genres,
    item?.genreNames,
    item?.providerGenres,
    item?.genre,
    item?.genreName,
    item?.primaryGenre,
  ]
  const values = rawValues
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => (typeof value === "string" ? value : value?.name))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)

  return values.length > 0 ? [...new Set(values)] : undefined
}

export async function fetchLiveAppleMusicChart(
  region: "vn" | "us",
  legacyGenreOrLimit?: TrackGenre | number,
  maybeLimit = 50
): Promise<PublicChartTrack[]> {
  const limit = typeof legacyGenreOrLimit === "number" ? legacyGenreOrLimit : maybeLimit
  const cacheKey = `apple-${region}-${limit}`
  const cached = chartsCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data
  }

  const url = `https://rss.applemarketingtools.com/api/v2/${region}/music/most-played/${limit}/songs.json`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })

    if (!response.ok) {
      throw new Error(`Apple Music RSS returned HTTP ${response.status}`)
    }

    const data = await response.json()
    const results = Array.isArray(data?.feed?.results) ? data.feed.results : []
    const tracks: PublicChartTrack[] = results.map((item: any, index: number) => {
      const providerGenres = readProviderGenres(item)
      return {
        id: `apple-${region}-${item.id || index}`,
        name: item.name || "Unknown Track",
        artists: item.artistName || "Unknown Artist",
        albumImage: item.artworkUrl100
          ? item.artworkUrl100.replace("100x100bb", "600x600bb")
          : null,
        previewUrl: null,
        region,
        rank: index + 1,
        ...(providerGenres ? { providerGenres } : {}),
      }
    })

    if (tracks.length > 0) {
      chartsCache.set(cacheKey, { data: tracks, fetchedAt: Date.now() })
      return tracks
    }

    return []
  } catch (error) {
    if (cached) return cached.data
    console.warn(`[Charts] Apple Music ${region} chart unavailable:`, error)
    return []
  } finally {
    clearTimeout(timeout)
  }
}

function classifyTracks(tracks: PublicChartTrack[]) {
  return tracks.map((track) => {
    const classification = classifyChartGenre({
      name: track.name,
      artists: track.artists,
      region: track.region,
      providerGenres: track.providerGenres,
    })
    if (!classification) return track

    return {
      ...track,
      genre: classification.genre,
      genreEvidence: classification.evidence,
      genreConfidence: classification.confidence,
    }
  })
}

export async function fetchAllLiveCharts(): Promise<LiveChartBuckets> {
  const [vietnamese, unitedStates] = await Promise.all([
    fetchLiveAppleMusicChart("vn", 50),
    fetchLiveAppleMusicChart("us", 50),
  ])
  const classified = classifyTracks([...vietnamese, ...unitedStates])

  return {
    vpop: classified.filter((track) => track.genre === "vpop"),
    usuk: classified.filter((track) => track.genre === "usuk"),
    rap: classified.filter((track) => track.genre === "rap"),
  }
}

export function resetLiveChartsCacheForTests() {
  chartsCache.clear()
}
