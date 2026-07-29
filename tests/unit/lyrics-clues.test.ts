import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildLyricsClue,
  maskTitleAndArtistWords,
  selectLyricsSnippetIndex,
} from "@/lib/lyrics-clues"
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

  it("masks short song titles", () => {
    const shortTitleTrack: GameTrack = {
      ...track,
      name: "Em",
      artists: "Binz",
      lyricsSnippets: ["Em vẫn ở đây cùng Binz"],
    }

    const clue = buildLyricsClue(shortTitleTrack, 5).toLowerCase()
    assert.equal(clue.includes("em"), false)
    assert.equal(clue.includes("binz"), false)
  })
})
