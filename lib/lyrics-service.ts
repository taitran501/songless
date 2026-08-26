export interface LrclibTrackResponse {
  id?: number
  name?: string
  trackName?: string
  artistName?: string
  albumName?: string
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

const LRCLIB_BASE_URL = "https://lrclib.net/api"
const LRCLIB_USER_AGENT = "SonglessUnlimited/1.0 (https://github.com/taitran501/songless)"
const REQUEST_TIMEOUT_MS = 6000

// In-memory runtime cache for lyrics
const memoryLyricsCache = new Map<string, { lyrics: string | null; cachedAt: number }>()
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getCacheKey(title: string, artist: string): string {
  return `${artist.toLowerCase().trim()}:::${title.toLowerCase().trim()}`
}

function cleanQueryString(value: string): string {
  return value
    .replace(/\s*\((feat|ft|featuring|with)\.?.*?\)/gi, "")
    .replace(/\s*-\s*(official\s*)?(music\s*)?(video|audio|lyrics?|lyric video|mv).*$/gi, "")
    .replace(/\s*\[.*?\]/g, "")
    .trim()
}

export async function fetchLyricsFromLrclib(
  title: string,
  artist: string,
  durationSeconds?: number
): Promise<string | null> {
  const cleanTitle = cleanQueryString(title)
  const cleanArtist = cleanQueryString(artist)
  const cacheKey = getCacheKey(cleanTitle, cleanArtist)

  // 1. Check in-memory cache
  const cached = memoryLyricsCache.get(cacheKey)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.lyrics
  }

  // 2. Fetch from LRCLIB get endpoint
  try {
    const params = new URLSearchParams({
      track_name: cleanTitle,
      artist_name: cleanArtist,
    })
    if (durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0) {
      params.set("duration", Math.round(durationSeconds).toString())
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    const response = await fetch(`${LRCLIB_BASE_URL}/get?${params.toString()}`, {
      headers: {
        "User-Agent": LRCLIB_USER_AGENT,
        "Accept": "application/json",
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (response.ok) {
      const data: LrclibTrackResponse = await response.json()
      if (!data.instrumental && data.plainLyrics && data.plainLyrics.trim().length > 20) {
        const lyrics = data.plainLyrics.trim()
        memoryLyricsCache.set(cacheKey, { lyrics, cachedAt: Date.now() })
        return lyrics
      }
    } else if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After")
      console.warn(`[LRCLIB] Rate limited (429). Retry-After: ${retryAfter}s`)
    }
  } catch (error: any) {
    if (error.name !== "AbortError") {
      console.warn(`[LRCLIB] Direct lookup failed for "${cleanArtist} - ${cleanTitle}":`, error.message)
    }
  }

  // 3. Fallback to LRCLIB search endpoint
  try {
    const searchController = new AbortController()
    const searchTimeout = setTimeout(() => searchController.abort(), REQUEST_TIMEOUT_MS)

    const searchParams = new URLSearchParams({
      q: `${cleanArtist} ${cleanTitle}`,
    })

    const searchResponse = await fetch(`${LRCLIB_BASE_URL}/search?${searchParams.toString()}`, {
      headers: {
        "User-Agent": LRCLIB_USER_AGENT,
        "Accept": "application/json",
      },
      signal: searchController.signal,
    })
    clearTimeout(searchTimeout)

    if (searchResponse.ok) {
      const results: LrclibTrackResponse[] = await searchResponse.json()
      if (Array.isArray(results) && results.length > 0) {
        for (const item of results) {
          if (!item.instrumental && item.plainLyrics && item.plainLyrics.trim().length > 20) {
            const lyrics = item.plainLyrics.trim()
            memoryLyricsCache.set(cacheKey, { lyrics, cachedAt: Date.now() })
            return lyrics
          }
        }
      }
    }
  } catch (error: any) {
    if (error.name !== "AbortError") {
      console.warn(`[LRCLIB] Search fallback failed for "${cleanArtist} - ${cleanTitle}":`, error.message)
    }
  }

  // Cache null result to prevent repeated hammering
  memoryLyricsCache.set(cacheKey, { lyrics: null, cachedAt: Date.now() })
  return null
}
