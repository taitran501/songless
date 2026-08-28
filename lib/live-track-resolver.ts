import { extractDynamicSnippets } from "@/lib/lyrics-extractor"
import { fetchLyricsFromLrclib } from "@/lib/lyrics-service"
import { searchYouTubeVideo } from "@/lib/youtube"
import type { PublicChartTrack } from "@/lib/public-charts"
import { hasApprovedAudioStart, type GameTrack } from "@/lib/tracks"

export interface LiveTrackResolveOptions {
  excludeVideoIds?: readonly string[]
}

const APPROVED_DAILY_SOURCE_TYPES = new Set(["official_audio", "lyric_video", "music_video"])

export async function resolveLiveTrackToGameTrack(
  chartTrack: PublicChartTrack,
  challengeId?: string,
  options: LiveTrackResolveOptions = {}
): Promise<GameTrack | null> {
  const searchQuery = `${chartTrack.artists} - ${chartTrack.name}`

  let youtubeMatch: Awaited<ReturnType<typeof searchYouTubeVideo>>
  try {
    youtubeMatch = await searchYouTubeVideo(
      chartTrack.name,
      chartTrack.artists,
      { excludeVideoIds: options.excludeVideoIds }
    )
  } catch (err) {
    console.warn(`[LiveResolver] Verified YouTube search failed for "${searchQuery}":`, err)
    return null
  }

  let snippets: string[] = []
  try {
    const plainLyrics = await fetchLyricsFromLrclib(chartTrack.name, chartTrack.artists)
    if (plainLyrics) {
      snippets = extractDynamicSnippets(plainLyrics, {
        name: chartTrack.name,
        artists: chartTrack.artists,
      })
    }
  } catch (err) {
    console.warn(`[LiveResolver] LRCLIB lookup failed for "${searchQuery}":`, err)
  }

  const hasApprovedAnalysis = hasApprovedAudioStart(chartTrack)
  const hasVerifiedDailySource =
    Boolean(chartTrack.genre && chartTrack.genreEvidence) &&
    hasApprovedAnalysis &&
    APPROVED_DAILY_SOURCE_TYPES.has(youtubeMatch.sourceType)

  return {
    source: "youtube",
    uri: `youtube:${youtubeMatch.videoId}`,
    videoId: youtubeMatch.videoId,
    name: chartTrack.name,
    artists: chartTrack.artists,
    duration_ms: 0,
    albumImage:
      chartTrack.albumImage || `https://i.ytimg.com/vi/${youtubeMatch.videoId}/hqdefault.jpg`,
    preview_url: chartTrack.previewUrl || null,
    ...(chartTrack.genre ? { genre: chartTrack.genre } : {}),
    ...(chartTrack.genreEvidence ? { genreEvidence: chartTrack.genreEvidence } : {}),
    ...(chartTrack.genreConfidence !== undefined
      ? { genreConfidence: chartTrack.genreConfidence }
      : {}),
    challengeId: challengeId || `live-${chartTrack.id}`,
    dailyEligible: hasVerifiedDailySource,
    sourceType: youtubeMatch.sourceType,
    lyricsSnippets: snippets.length > 0 ? snippets : undefined,
    ...(chartTrack.audioStartSeconds !== undefined
      ? { audioStartSeconds: chartTrack.audioStartSeconds }
      : {}),
    ...(chartTrack.audioFirstManifest !== undefined
      ? { audioFirstManifest: chartTrack.audioFirstManifest }
      : {}),
    ...(chartTrack.audioAnalysisStatus
      ? { audioAnalysisStatus: chartTrack.audioAnalysisStatus }
      : { audioAnalysisStatus: "needs_review" as const }),
    ...(chartTrack.audioStartConfidence !== undefined
      ? { audioStartConfidence: chartTrack.audioStartConfidence }
      : {}),
  }
}
