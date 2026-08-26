import { searchYouTubeSuggestions } from "@/lib/youtube"
import { fetchLyricsFromLrclib } from "@/lib/lyrics-service"
import { extractDynamicSnippets } from "@/lib/lyrics-extractor"
import type { GameTrack, TrackGenre } from "@/lib/tracks"
import type { PublicChartTrack } from "@/lib/public-charts"

export async function resolveLiveTrackToGameTrack(
  chartTrack: PublicChartTrack,
  challengeId?: string
): Promise<GameTrack | null> {
  const searchQuery = `${chartTrack.artists} - ${chartTrack.name}`

  // 1. Resolve YouTube Audio
  let videoId: string | null = null
  let albumImage = chartTrack.albumImage

  try {
    const ytResults = await searchYouTubeSuggestions(searchQuery)
    if (ytResults.length > 0) {
      videoId = ytResults[0].videoId
      if (!albumImage && ytResults[0].albumImage) {
        albumImage = ytResults[0].albumImage
      }
    }
  } catch (err) {
    console.warn(`[LiveResolver] YouTube search failed for "${searchQuery}":`, err)
  }

  // Fallback to preview url if no video found
  const uri = videoId ? `youtube:${videoId}` : `chart:${chartTrack.id}`

  // 2. Resolve Official Lyrics from LRCLIB
  let plainLyrics: string | null = null
  let snippets: string[] = []

  try {
    plainLyrics = await fetchLyricsFromLrclib(chartTrack.name, chartTrack.artists)
    if (plainLyrics) {
      snippets = extractDynamicSnippets(plainLyrics, {
        name: chartTrack.name,
        artists: chartTrack.artists,
      })
    }
  } catch (err) {
    console.warn(`[LiveResolver] LRCLIB lyrics lookup failed for "${searchQuery}":`, err)
  }

  return {
    source: videoId ? "youtube" : "spotify",
    uri,
    videoId: videoId || undefined,
    name: chartTrack.name,
    artists: chartTrack.artists,
    duration_ms: 0,
    albumImage: albumImage || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
    preview_url: chartTrack.previewUrl || null,
    genre: chartTrack.genre,
    challengeId: challengeId || `live-${chartTrack.id}`,
    dailyEligible: Boolean(videoId || chartTrack.previewUrl),
    sourceType: "official_audio",
    lyricsSnippets: snippets.length > 0 ? snippets : undefined,
    audioStartSeconds: 0,
  }
}
