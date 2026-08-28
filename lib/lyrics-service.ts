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
const NEGATIVE_CACHE_TTL_MS = 60 * 60 * 1000

// In-memory runtime cache for lyrics
const memoryLyricsCache = new Map<
  string,
  { lyrics: string | null; cachedAt: number; ttlMs: number }
>()
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

function normalizeMatchValue(value: string) {
  return cleanQueryString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function matchesProviderValue(target: string, candidate: string) {
  const normalizedTarget = normalizeMatchValue(target)
  const normalizedCandidate = normalizeMatchValue(candidate)
  if (!normalizedTarget || !normalizedCandidate) return false
  return (
    normalizedTarget === normalizedCandidate ||
    normalizedTarget.startsWith(`${normalizedCandidate} `) ||
    normalizedCandidate.startsWith(`${normalizedTarget} `)
  )
}

function matchesRequestedTrack(
  item: LrclibTrackResponse,
  title: string,
  artist: string
) {
  const providerTitle =
    typeof item.trackName === "string"
      ? item.trackName
      : typeof item.name === "string"
        ? item.name
        : ""
  const providerArtist = typeof item.artistName === "string" ? item.artistName : ""
  return (
    matchesProviderValue(title, providerTitle) &&
    matchesProviderValue(artist, providerArtist)
  )
}

function hasUsableLyrics(item: LrclibTrackResponse, title: string, artist: string) {
  if (!item || typeof item !== "object") return false
  return (
    matchesRequestedTrack(item, title, artist) &&
    !item.instrumental &&
    typeof item.plainLyrics === "string" &&
    item.plainLyrics.trim().length > 20
  )
}

async function fetchLrclib(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": LRCLIB_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
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
  if (cached && Date.now() - cached.cachedAt < cached.ttlMs) {
    return cached.lyrics
  }
  if (cached) memoryLyricsCache.delete(cacheKey)

  let providerUnavailable = false

  // 2. Fetch from LRCLIB get endpoint
  try {
    const params = new URLSearchParams({
      track_name: cleanTitle,
      artist_name: cleanArtist,
    })
    if (durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0) {
      params.set("duration", Math.round(durationSeconds).toString())
    }

    const response = await fetchLrclib(`${LRCLIB_BASE_URL}/get?${params.toString()}`)

    if (response.ok) {
      const data: LrclibTrackResponse = await response.json()
      if (hasUsableLyrics(data, cleanTitle, cleanArtist)) {
        const lyrics = typeof data.plainLyrics === "string" ? data.plainLyrics.trim() : ""
        memoryLyricsCache.set(cacheKey, {
          lyrics,
          cachedAt: Date.now(),
          ttlMs: CACHE_TTL_MS,
        })
        return lyrics
      }
    } else if (response.status === 429 || response.status >= 500) {
      providerUnavailable = true
      const retryAfter = response.headers.get("Retry-After")
      console.warn(
        `[LRCLIB] Provider unavailable (${response.status}). Retry-After: ${retryAfter ?? "unknown"}`
      )
    }
  } catch (error: any) {
    providerUnavailable = true
    if (error.name !== "AbortError") {
      console.warn(`[LRCLIB] Direct lookup failed for "${cleanArtist} - ${cleanTitle}":`, error.message)
    }
  }

  // 3. Fallback to LRCLIB search endpoint
  try {
    const searchParams = new URLSearchParams({
      q: `${cleanArtist} ${cleanTitle}`,
    })

    const searchResponse = await fetchLrclib(
      `${LRCLIB_BASE_URL}/search?${searchParams.toString()}`
    )

    if (searchResponse.ok) {
      const results: LrclibTrackResponse[] = await searchResponse.json()
      if (Array.isArray(results) && results.length > 0) {
        for (const item of results) {
          if (hasUsableLyrics(item, cleanTitle, cleanArtist)) {
            const lyrics = typeof item.plainLyrics === "string" ? item.plainLyrics.trim() : ""
            memoryLyricsCache.set(cacheKey, {
              lyrics,
              cachedAt: Date.now(),
              ttlMs: CACHE_TTL_MS,
            })
            return lyrics
          }
        }
      }
    } else if (searchResponse.status === 429 || searchResponse.status >= 500) {
      providerUnavailable = true
    }
  } catch (error: any) {
    providerUnavailable = true
    if (error.name !== "AbortError") {
      console.warn(`[LRCLIB] Search fallback failed for "${cleanArtist} - ${cleanTitle}":`, error.message)
    }
  }

  // Do not poison the cache for a week when LRCLIB is rate-limited or down.
  // A short negative cache is only used when the provider responded normally
  // but had no matching lyrics.
  if (!providerUnavailable) {
    memoryLyricsCache.set(cacheKey, {
      lyrics: null,
      cachedAt: Date.now(),
      ttlMs: NEGATIVE_CACHE_TTL_MS,
    })
  }
  return null
}

export function resetLyricsCacheForTests() {
  memoryLyricsCache.clear()
}
