export interface PublicChartTrack {
  id: string
  name: string
  artists: string
  albumImage: string | null
  previewUrl: string | null
  genre: "vpop" | "usuk" | "rap"
  rank: number
}

// In-memory cache for live charts with 6 hours TTL
const chartsCache = new Map<string, { data: PublicChartTrack[]; fetchedAt: number }>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export async function fetchLiveAppleMusicChart(
  region: "vn" | "us",
  genre: "vpop" | "usuk" | "rap",
  limit = 50
): Promise<PublicChartTrack[]> {
  const cacheKey = `apple-${region}-${genre}-${limit}`
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
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Apple Music RSS returned HTTP ${response.status}`)
    }

    const data = await response.json()
    const results = Array.isArray(data?.feed?.results) ? data.feed.results : []

    const tracks: PublicChartTrack[] = results.map((item: any, index: number) => ({
      id: `apple-${region}-${item.id || index}`,
      name: item.name || "Unknown Track",
      artists: item.artistName || "Unknown Artist",
      albumImage: item.artworkUrl100 ? item.artworkUrl100.replace("100x100bb", "600x600bb") : null,
      previewUrl: null,
      genre,
      rank: index + 1,
    }))

    if (tracks.length > 0) {
      chartsCache.set(cacheKey, { data: tracks, fetchedAt: Date.now() })
      return tracks
    }

    return []
  } catch (error) {
    if (cached) return cached.data
    return []
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchAllLiveCharts(): Promise<Record<"vpop" | "usuk" | "rap", PublicChartTrack[]>> {
  const [vpop, usuk, rap] = await Promise.all([
    fetchLiveAppleMusicChart("vn", "vpop", 50),
    fetchLiveAppleMusicChart("us", "usuk", 50),
    fetchLiveAppleMusicChart("us", "rap", 50),
  ])

  return {
    vpop,
    usuk,
    rap,
  }
}
