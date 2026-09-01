import type { GameTrack } from "@/lib/tracks"
import { isYouTubePlaylistInput } from "@/lib/youtube"

export interface RecentYouTubePlaylist {
  id: string
  name: string
  trackCount?: number
  source: "youtube"
}

/**
 * Migrate the persisted recent-playlist list to the supported product
 * surface.  Older entries may be Spotify records; they are intentionally
 * discarded instead of being rendered as reloadable playlists.
 */
export function normalizeRecentYouTubePlaylists(value: unknown): RecentYouTubePlaylist[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const recent: RecentYouTubePlaylist[] = []
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue
    const playlist = candidate as {
      id?: unknown
      name?: unknown
      trackCount?: unknown
    }
    if (
      typeof playlist.id !== "string" ||
      !isYouTubePlaylistInput(playlist.id) ||
      typeof playlist.name !== "string" ||
      !playlist.name.trim()
    ) {
      continue
    }

    const id = playlist.id.trim()
    if (seen.has(id)) continue
    seen.add(id)
    recent.push({
      id,
      name: playlist.name.trim(),
      ...(typeof playlist.trackCount === "number" &&
      Number.isInteger(playlist.trackCount) &&
      playlist.trackCount >= 0
        ? { trackCount: playlist.trackCount }
        : {}),
      source: "youtube",
    })
    if (recent.length >= 6) break
  }

  return recent
}

/**
 * A track list in the global store is shared by every game mode. It is only a
 * playlist selection when it has an owning playlist id as well as playable
 * tracks. Keeping this contract in one place prevents Daily/Genre/Lyrics
 * tracks from being rendered as a stale playlist after route navigation.
 */
export function hasLoadedPlaylistSelection(
  activePlaylistId: string | null | undefined,
  tracks: readonly GameTrack[]
) {
  return Boolean(activePlaylistId && isYouTubePlaylistInput(activePlaylistId) && tracks.length > 0)
}
