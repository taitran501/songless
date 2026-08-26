import type { GameTrack, TrackGenre } from "@/lib/tracks"
import { fetchAllLiveCharts } from "@/lib/public-charts"
import { resolveLiveTrackToGameTrack } from "@/lib/live-track-resolver"
import { searchYouTubeSuggestions } from "@/lib/youtube"
import { fetchLyricsFromLrclib } from "@/lib/lyrics-service"
import { extractDynamicSnippets } from "@/lib/lyrics-extractor"

export type DifficultyTier = "easy" | "medium" | "hard"

export interface TieredTrack extends GameTrack {
  tier: DifficultyTier
  chartRank: number
}

function hashDateString(dateKey: string, salt = ""): number {
  const combined = `${dateKey}:${salt}`
  let hash = 2166136261
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Dynamically builds 3 daily tracks from live public charts (Apple Music VN, US).
 */
export async function getLiveDailyChallenge(dateKey: string): Promise<GameTrack[]> {
  const liveCharts = await fetchAllLiveCharts()
  const genres: { genre: TrackGenre; tier: DifficultyTier }[] = [
    { genre: "vpop", tier: "easy" },
    { genre: "usuk", tier: "medium" },
    { genre: "rap", tier: "hard" },
  ]

  const results: GameTrack[] = []

  for (const { genre, tier } of genres) {
    const list = liveCharts[genre] || []
    if (list.length > 0) {
      // Pick based on tier rank ranges
      const startIndex = tier === "easy" ? 0 : tier === "medium" ? 5 : 15
      const offset = hashDateString(dateKey, `${genre}-${tier}`) % 10
      const trackIndex = Math.min(startIndex + offset, list.length - 1)
      const chartTrack = list[trackIndex]
      const gameTrack = await resolveLiveTrackToGameTrack(
        chartTrack,
        `daily-${dateKey}-${genre}`
      )
      if (gameTrack) {
        results.push(gameTrack)
        continue
      }
    }

    // Dynamic search fallback on live YouTube
    const candidates = await searchYouTubeSuggestions(`${genre} trending hits official audio`)
    const candidate = candidates[0]
    if (candidate) {
      const lyrics = await fetchLyricsFromLrclib(candidate.name, candidate.artists)
      const snippets = lyrics ? extractDynamicSnippets(lyrics, candidate) : []
      results.push({
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
      })
    }
  }

  return results
}
