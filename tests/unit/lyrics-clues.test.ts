import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  analyzeLyricsSnippetQuality,
  buildLyricsClue,
  getEligibleLyricsSnippetIndices,
  maskTitleAndArtistWords,
  selectLyricsSnippetIndex,
} from "@/lib/lyrics-clues"
import { CURATED_TRACKS } from "@/lib/curated-tracks"
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
  it("keeps at least one quality-gated snippet for every curated track", () => {
    for (const curatedTrack of CURATED_TRACKS) {
      const eligibleIndices = getEligibleLyricsSnippetIndices(curatedTrack)
      assert.ok(
        eligibleIndices.length > 0,
        `${curatedTrack.challengeId} has no eligible lyric snippet`
      )
      for (const index of eligibleIndices) {
        const quality = analyzeLyricsSnippetQuality(
          curatedTrack,
          curatedTrack.lyricsSnippets![index]
        )
        assert.ok(quality.visibleWordCount >= 8)
        assert.ok(quality.visibleCharacterRatio >= 0.6)
      }
    }
  })

  it("masks title and artist words", () => {
    const masked = maskTitleAndArtistWords(track.lyricsSnippets![0], track).toLowerCase()

    assert.equal(masked.includes("bright"), false)
    assert.equal(masked.includes("city"), false)
    assert.equal(masked.includes("night"), false)
    assert.equal(masked.includes("singer"), false)
  })

  it("reveals more text as stages advance", () => {
    const clues = Array.from({ length: 6 }, (_, stage) => buildLyricsClue(track, stage))
    const visiblePositions = clues.map((clue) =>
      clue
        .split(/\s+/)
        .map((word, index) => (/[A-Za-z\u00C0-\u1EF9]/.test(word) ? index : -1))
        .filter((index) => index >= 0)
    )

    for (let stage = 1; stage < visiblePositions.length; stage++) {
      assert.ok(
        visiblePositions[stage - 1].every((index) => visiblePositions[stage].includes(index))
      )
    }
    assert.equal(buildLyricsClue(track, 3), buildLyricsClue(track, 3))
  })

  it("keeps short clues partially hidden until the final stage", () => {
    const clue = buildLyricsClue(track, 2)

    assert.ok(clue.includes("----"))
  })

  it("uses the requested lyric snippet", () => {
    const multiSnippetTrack: GameTrack = {
      ...track,
      lyricsSnippets: [
        "First clue stays here for the opening run",
        "Second clue changes the replay experience",
      ],
    }

    assert.match(buildLyricsClue(multiSnippetTrack, 5, 0), /First clue/)
    assert.match(buildLyricsClue(multiSnippetTrack, 5, 1), /Second clue/)
  })

  it("selects a stable snippet for the same session and can rotate across sessions", () => {
    const multiSnippetTrack: GameTrack = {
      ...track,
      challengeId: "bright-city",
      lyricsSnippets: ["One", "Two", "Three"],
    }

    const first = selectLyricsSnippetIndex(multiSnippetTrack, "run-a")
    assert.equal(selectLyricsSnippetIndex(multiSnippetTrack, "run-a"), first)

    const rotated = ["run-b", "run-c", "run-d", "run-e"]
      .map((seed) => selectLyricsSnippetIndex(multiSnippetTrack, seed))
      .some((index) => index !== first)
    assert.equal(rotated, true)
  })

  it("keeps short song titles hidden while revealing the artist in the final clue", () => {
    const shortTitleTrack: GameTrack = {
      ...track,
      name: "Em",
      artists: "Binz",
      lyricsSnippets: ["Em vẫn ở đây cùng Binz"],
    }

    const clue = buildLyricsClue(shortTitleTrack, 5).toLowerCase()
    assert.equal(clue.includes("em"), false)
    assert.equal(clue.includes("binz"), true)
  })
})
