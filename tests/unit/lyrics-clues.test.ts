import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildLyricsClue, maskTitleAndArtistWords } from "@/lib/lyrics-clues"
import type { GameTrack } from "@/lib/tracks"

const track: GameTrack = {
  source: "youtube",
  uri: "youtube:test",
  videoId: "test",
  name: "Bright City",
  artists: "Night Singer",
  duration_ms: 0,
  albumImage: null,
  preview_url: null,
  lyricsSnippets: ["Bright lights guide the Night Singer through the city"],
}

describe("lyrics clues", () => {
  it("masks title and artist words", () => {
    const masked = maskTitleAndArtistWords(track.lyricsSnippets![0], track).toLowerCase()

    assert.equal(masked.includes("bright"), false)
    assert.equal(masked.includes("city"), false)
    assert.equal(masked.includes("night"), false)
    assert.equal(masked.includes("singer"), false)
  })

  it("reveals more text as stages advance", () => {
    const early = buildLyricsClue(track, 0)
    const late = buildLyricsClue(track, 5)

    assert.ok(early.includes("----"))
    assert.equal(late.includes("----"), false)
  })
})
