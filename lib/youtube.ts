import type { GameTrack } from "@/lib/tracks"

const YOUTUBE_TIMEOUT_MS = 10000
const YOUTUBE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
}

export class YouTubeError extends Error {
  constructor(
    message: string,
    public status = 500
  ) {
    super(message)
  }
}

export interface ParsedYouTubePlaylist {
  playlistName: string
  tracks: GameTrack[]
}

export function extractYouTubePlaylistId(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9_-]{18,40}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const listId = url.searchParams.get("list")
    if (listId) return listId
  } catch {
    // Fall through to regex.
  }

  const match = trimmed.match(/[&?]list=([a-zA-Z0-9_-]{18,40})/)
  return match?.[1] || null
}

export function isYouTubePlaylistInput(input: string): boolean {
  const trimmed = input.trim()
  return (
    trimmed.includes("youtube.com") ||
    trimmed.includes("youtu.be") ||
    /^(PL|UU|FL|LL|RD|OLMC)[a-zA-Z0-9_-]{16,38}$/.test(trimmed)
  )
}

function parseDuration(durationStr: string): number {
  if (!durationStr) return 0
  const parts = durationStr.split(":").map(Number)
  if (parts.some((part) => Number.isNaN(part))) return 0

  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
  if (parts.length === 1) return parts[0] * 1000
  return 0
}

async function fetchTextWithTimeout(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: YOUTUBE_HEADERS,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new YouTubeError("Could not reach YouTube. Try again later.", response.status)
    }

    return await response.text()
  } catch (error) {
    if (error instanceof YouTubeError) throw error
    throw new YouTubeError("YouTube request timed out or failed.", 502)
  } finally {
    clearTimeout(timeout)
  }
}

function readInitialData(html: string): any {
  const match = html.match(/(?:var ytInitialData|ytInitialData)\s*=\s*({[\s\S]*?});<\/script>/)
  if (!match?.[1]) {
    throw new YouTubeError("Could not parse this YouTube playlist.", 422)
  }

  try {
    return JSON.parse(match[1])
  } catch {
    throw new YouTubeError("Could not parse this YouTube playlist.", 422)
  }
}

function findAlertText(data: any): string | null {
  const alerts = data?.alerts
  if (!Array.isArray(alerts)) return null
  for (const alert of alerts) {
    const text = alert.alertRenderer?.text?.runs?.[0]?.text
    if (typeof text === "string" && text.trim()) return text
  }
  return null
}

function toYoutubeTrack(input: {
  videoId: string
  title: string
  artist: string
  durationMs: number
  albumImage: string | null
}): GameTrack | null {
  if (!input.videoId || !input.title) return null
  return {
    source: "youtube",
    uri: `youtube:${input.videoId}`,
    videoId: input.videoId,
    name: input.title,
    artists: input.artist || "Unknown Artist",
    duration_ms: input.durationMs || 0,
    albumImage: input.albumImage,
    preview_url: null,
  }
}

function parseLockupItem(item: any): GameTrack | null {
  const lockup = item?.lockupViewModel
  if (!lockup || lockup.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return null

  const videoId = lockup.contentId
  const title = lockup.metadata?.lockupMetadataViewModel?.title?.content || "Unknown Title"
  const metadataRows =
    lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows
  const artist = metadataRows?.[0]?.metadataParts?.[0]?.text?.content || "Unknown Artist"
  const overlays = lockup.contentImage?.thumbnailViewModel?.overlays || []
  let durationText = ""
  for (const overlay of overlays) {
    const badgeText = overlay.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text
    if (badgeText) {
      durationText = badgeText
      break
    }
  }
  const sources = lockup.contentImage?.thumbnailViewModel?.image?.sources

  return toYoutubeTrack({
    videoId,
    title,
    artist,
    durationMs: parseDuration(durationText),
    albumImage: Array.isArray(sources) && sources.length > 0 ? sources[sources.length - 1].url : null,
  })
}

function parsePlaylistVideoItem(item: any): GameTrack | null {
  const videoRenderer = item?.playlistVideoRenderer
  if (!videoRenderer) return null

  const thumbnails = videoRenderer.thumbnail?.thumbnails
  return toYoutubeTrack({
    videoId: videoRenderer.videoId,
    title: videoRenderer.title?.runs?.[0]?.text || "Unknown Title",
    artist: videoRenderer.shortBylineText?.runs?.[0]?.text || "Unknown Artist",
    durationMs: parseInt(videoRenderer.lengthSeconds || "0", 10) * 1000,
    albumImage: Array.isArray(thumbnails) && thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null,
  })
}

function collectPlaylistItems(data: any): any[] {
  const tabContent = data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
  const sectionList = tabContent?.sectionListRenderer?.contents
  const itemSection = sectionList?.[0]?.itemSectionRenderer?.contents
  const directList = tabContent?.playlistVideoListRenderer?.contents
  const nestedList = itemSection?.[0]?.playlistVideoListRenderer?.contents

  return [itemSection, directList, nestedList]
    .filter((items) => Array.isArray(items))
    .flat()
}

export function parseYouTubePlaylistHtml(html: string): ParsedYouTubePlaylist {
  const data = readInitialData(html)
  const alertText = findAlertText(data)

  if (alertText) {
    const lower = alertText.toLowerCase()
    if (
      lower.includes("not exist") ||
      lower.includes("private") ||
      lower.includes("unavailable") ||
      alertText.includes("không tồn tại")
    ) {
      throw new YouTubeError(`YouTube playlist error: ${alertText}`, 404)
    }
  }

  const tracks = collectPlaylistItems(data)
    .map((item) => parseLockupItem(item) || parsePlaylistVideoItem(item))
    .filter((track): track is GameTrack => track !== null)

  if (tracks.length === 0) {
    throw new YouTubeError("No playable videos were found in this playlist.", 422)
  }

  return {
    playlistName: data.metadata?.playlistMetadataRenderer?.title || "YouTube Playlist",
    tracks,
  }
}

export async function parseYouTubePlaylist(input: string): Promise<ParsedYouTubePlaylist> {
  const playlistId = extractYouTubePlaylistId(input)
  if (!playlistId) {
    throw new YouTubeError("Invalid YouTube playlist URL or ID.", 400)
  }

  const html = await fetchTextWithTimeout(`https://www.youtube.com/playlist?list=${playlistId}`)
  return parseYouTubePlaylistHtml(html)
}

export async function searchYouTubeVideo(query: string): Promise<{ videoId: string }> {
  const trimmed = query.trim()
  if (!trimmed) {
    throw new YouTubeError("Search query is required.", 400)
  }

  const html = await fetchTextWithTimeout(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(`${trimmed} audio`)}`
  )
  const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)
  if (!match?.[1]) {
    throw new YouTubeError("No YouTube video was found.", 404)
  }

  return { videoId: match[1] }
}
