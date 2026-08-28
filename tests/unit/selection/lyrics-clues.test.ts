import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  analyzeLyricsSnippetQuality,
  buildLyricsClue,
  getEligibleLyricsSnippetIndices,
  maskTitleAndArtistWords,
} from "@/lib/lyrics-clues"
import type { GameTrack } from "@/lib/tracks"

const sampleTrack: GameTrack = {
  source: "youtube",
  uri: "youtube:test",
  videoId: "test",
  name: "Bright City",
  artists: "Night Singer",
  duration_ms: 0,
  albumImage: null,
  preview_url: null,
  lyricsSnippets: [
    "Bright lights guide the Night Singer through the city streets and endless highways",
  ],
}

describe("lyrics clues", () => {
  it("keeps quality-gated snippets for valid tracks", () => {
    const eligibleIndices = getEligibleLyricsSnippetIndices(sampleTrack)
    assert.ok(eligibleIndices.length > 0)
    for (const index of eligibleIndices) {
      const quality = analyzeLyricsSnippetQuality(
        sampleTrack,
        sampleTrack.lyricsSnippets![index]
      )
      assert.ok(quality.visibleWordCount >= 5)
    }
  })

  it("masks title and artist words", () => {
    assert.equal(
      maskTitleAndArtistWords("Bright city Night Singer wanders alone", sampleTrack),
      "______ ____ _____ ______ wanders alone"
    )
  })

  it("reveals more text as stages advance", () => {
    const clueStage0 = buildLyricsClue(sampleTrack, 0, 0)
    const clueStage5 = buildLyricsClue(sampleTrack, 5, 0)

    // Stage 0 has hidden dashes
    assert.ok(clueStage0.includes("-"), "Stage 0 should contain hidden dashes")
    // Stage 5 has the full unmasked lyrics except title/artist
    assert.ok(clueStage5.includes("streets"), "Final stage should reveal words")
    assert.ok(clueStage5.includes("highways"), "Final stage should reveal words")
  })
})
