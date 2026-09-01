import type { GameTrack } from "@/lib/tracks"

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
  return Boolean(activePlaylistId?.trim() && tracks.length > 0)
}
