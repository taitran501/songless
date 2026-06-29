import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isCorrectGuess, normalizeGuessText } from "@/lib/guessing"
import type { GameTrack } from "@/lib/tracks"

const target: GameTrack = {
  source: "spotify",
  uri: "spotify:track:test",
  name: "The Song (feat. Guest) - Remastered",
  artists: "Artist",
  duration_ms: 180000,
  albumImage: null,
  preview_url: null,
}

describe("guessing", () => {
  it("accepts exact normalized title", () => {
    assert.equal(isCorrectGuess({ guess: "The Song", target }), true)
  })

  it("ignores punctuation differences", () => {
    assert.equal(normalizeGuessText("The--Song!!"), "the song")
  })

  it("removes remaster and featured text", () => {
    assert.equal(normalizeGuessText(target.name), "the song")
  })

  it("rejects too-short partial guesses", () => {
    assert.equal(isCorrectGuess({ guess: "the", target }), false)
  })

  it("accepts selected suggestion URI match", () => {
    assert.equal(isCorrectGuess({ guess: "wrong text", target, selectedUri: target.uri }), true)
  })

  it("accepts selected suggestion with same normalized title and different URI", () => {
    assert.equal(
      isCorrectGuess({
        guess: "Artist - The Song (Official Music Video)",
        target,
        selectedUri: "youtube:different",
        selectedSuggestion: {
          uri: "youtube:different",
          name: "The Song (Official Music Video)",
          artists: "Artist",
        },
      }),
      true
    )
  })

  it("accepts selected suggestion for short matching titles", () => {
    const shortTarget: GameTrack = {
      source: "youtube",
      uri: "youtube:target",
      name: "Em",
      artists: "Binz",
      duration_ms: 180000,
      albumImage: null,
      preview_url: null,
    }

    assert.equal(
      isCorrectGuess({
        guess: "Some channel - Em",
        target: shortTarget,
        selectedUri: "youtube:other-video",
        selectedSuggestion: {
          uri: "youtube:other-video",
          name: "Em",
          artists: "Some channel",
        },
      }),
      true
    )
  })
})
