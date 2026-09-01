import assert from "node:assert/strict"
import test from "node:test"
import { hasLoadedPlaylistSelection } from "@/lib/playlist-selection"

const track = {
  source: "spotify" as const,
  uri: "spotify:track:one",
  name: "Track One",
  artists: "Artist One",
  duration_ms: 180_000,
  albumImage: null,
  preview_url: null,
}

test("playlist selection requires an owner id and tracks", () => {
  assert.equal(hasLoadedPlaylistSelection(null, [track]), false)
  assert.equal(hasLoadedPlaylistSelection("   ", [track]), false)
  assert.equal(hasLoadedPlaylistSelection("playlist-123", []), false)
  assert.equal(hasLoadedPlaylistSelection("playlist-123", [track]), true)
})
