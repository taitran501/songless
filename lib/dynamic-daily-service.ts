import { fetchAllLiveCharts, type PublicChartTrack } from "@/lib/public-charts"
import { resolveLiveTrackToGameTrack } from "@/lib/live-track-resolver"
import { searchYouTubeSuggestions } from "@/lib/youtube"
import { fetchLyricsFromLrclib } from "@/lib/lyrics-service"
import { extractDynamicSnippets } from "@/lib/lyrics-extractor"
import type { GameTrack, TrackGenre } from "@/lib/tracks"

export interface DynamicDailySet {
  dateKey: string
  tracks: GameTrack[]
  createdAt: string
}

// In-memory cache for dynamic daily sets per date
const dailySetsCache = new Map<string, DynamicDailySet>()

function hashDate(dateKey: string, salt = ""): number {
  const str = `${dateKey}:${salt}`
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Generates 3 live daily tracks (1 VPop, 1 USUK, 1 Rap) directly from official public charts and LRCLIB.
 */
export async function generateLiveDailyTracks(dateKey: string): Promise<GameTrack[]> {
  const cached = dailySetsCache.get(dateKey)
  if (cached) {
    return cached.tracks
  }

  const liveCharts = await fetchAllLiveCharts()
  const genres: TrackGenre[] = ["vpop", "usuk", "rap"]
  const selectedTracks: GameTrack[] = []

  for (const genre of genres) {
    const chartList = liveCharts[genre] || []

    let gameTrack: GameTrack | null = null

    if (chartList.length > 0) {
      // Pick a track from the top 30 based on date hash
      const trackIndex = hashDate(dateKey, genre) % Math.min(chartList.length, 30)
      const chartTrack = chartList[trackIndex]
      gameTrack = await resolveLiveTrackToGameTrack(
        chartTrack,
        `daily-${dateKey}-${genre}`
      )
    }

    // Fallback to live search if chart resolution failed
    if (!gameTrack) {
      const candidates = await searchYouTubeSuggestions(`${genre} top hits official audio`)
      const candidate = candidates[0] || {
        videoId: "fHI8X4OXluQ",
        uri: "youtube:fHI8X4OXluQ",
        name: "Blinding Lights",
        artists: "The Weeknd",
        albumImage: "https://i.ytimg.com/vi/fHI8X4OXluQ/hqdefault.jpg",
      }

      const lyrics = await fetchLyricsFromLrclib(candidate.name, candidate.artists)
      const snippets = lyrics ? extractDynamicSnippets(lyrics, candidate) : []

      gameTrack = {
        source: "youtube",
        uri: candidate.uri,
        videoId: candidate.videoId,
        name: candidate.name,
        artists: candidate.artists,
        duration_ms: 0,
        albumImage: candidate.albumImage,
        preview_url: null,
        genre,
        challengeId: `daily-${dateKey}-${genre}`,
        dailyEligible: true,
        sourceType: "official_audio",
        lyricsSnippets: snippets.length > 0 ? snippets : undefined,
        audioStartSeconds: 0,
      }
    }

    selectedTracks.push(gameTrack)
  }

  // Cache for the rest of the day
  dailySetsCache.set(dateKey, {
    dateKey,
    tracks: selectedTracks,
    createdAt: new Date().toISOString(),
  })

  return selectedTracks
}
