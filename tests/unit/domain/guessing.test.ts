import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  dedupeGuessSuggestions,
  getGuessSuggestionIdentity,
  getGuessSuggestionSourcePriority,
  isCorrectGuess,
  isRelevantGuessSuggestion,
  normalizeGuessText,
} from "@/lib/guessing"
import type { GameTrack } from "@/lib/tracks"
import { sameTitleDifferentArtist } from "@/tests/fixtures/tracks"

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
          artists: "Binz",
        },
      }),
      true
    )
  })

  it("rejects a same-title suggestion for a different artist", () => {
    assert.equal(
      isCorrectGuess({
        guess: "Artist B - Home",
        target: sameTitleDifferentArtist.target,
        selectedUri: sameTitleDifferentArtist.suggestion.uri,
        selectedSuggestion: sameTitleDifferentArtist.suggestion,
      }),
      false
    )
  })

  it("requires an artist identity on selected suggestions", () => {
    assert.equal(
      isCorrectGuess({
        guess: "Home",
        target: sameTitleDifferentArtist.target,
        selectedUri: "youtube:home-missing-artist",
        selectedSuggestion: {
          uri: "youtube:home-missing-artist",
          name: "Home",
          artists: "",
        },
      }),
      false
    )
  })

  it("normalizes Vietnamese accented titles and diacritics", () => {
    assert.equal(normalizeGuessText("Nàng Thơ"), "nang tho")
    assert.equal(normalizeGuessText("Có Chắc Yêu Là Đây"), "co chac yeu la day")
    assert.equal(normalizeGuessText("Đen Vâu"), "den vau")
    assert.equal(normalizeGuessText("Bước Qua Nhau"), "buoc qua nhau")

    const vnTarget: GameTrack = {
      source: "youtube",
      uri: "youtube:nang-tho",
      name: "Nang Tho",
      artists: "Hoang Dung",
      duration_ms: 0,
      albumImage: null,
      preview_url: null,
    }

    assert.equal(isCorrectGuess({ guess: "Nàng Thơ", target: vnTarget }), true)
    assert.equal(isCorrectGuess({ guess: "nang tho", target: vnTarget }), true)
  })

  it("dedupes suggestions by normalized title and artist", () => {
    const suggestions = [
      { uri: "youtube:official", name: "Home", artists: "Artist A" },
      { uri: "youtube:lyrics", name: "Home (Lyrics)", artists: "Artist A" },
      { uri: "youtube:live", name: "HOME", artists: "artist a" },
      { uri: "youtube:other", name: "Home", artists: "Artist B" },
    ]

    assert.equal(getGuessSuggestionIdentity(suggestions[0]), "home::artist a")
    assert.deepEqual(
      dedupeGuessSuggestions(suggestions).map((suggestion) => suggestion.uri),
      ["youtube:official", "youtube:other"]
    )
  })

  it("filters irrelevant and non-music YouTube suggestions", () => {
    assert.equal(
      isRelevantGuessSuggestion("abc", {
        name: "ABC News",
        artists: "World Broadcast",
        rawTitle: "ABC News live broadcast",
      }),
      false
    )
    assert.equal(
      isRelevantGuessSuggestion("roar", {
        name: "Roar",
        artists: "Katy Perry",
        rawTitle: "Katy Perry - Roar (Official Audio)",
      }),
      true
    )
    assert.equal(
      isRelevantGuessSuggestion("artist b home", {
        name: "Home",
        artists: "Artist B",
      }),
      true
    )
    assert.equal(
      isRelevantGuessSuggestion("roar", {
        name: "Unrelated Song",
        artists: "Another Artist",
      }),
      false
    )
  })

  it("prioritizes official audio variants when identities collide", () => {
    assert.equal(
      getGuessSuggestionSourcePriority({ name: "Roar", artists: "Katy Perry", rawTitle: "Katy Perry - Roar (Official Audio)" }),
      30
    )
    assert.equal(
      getGuessSuggestionSourcePriority({ name: "Roar", artists: "Katy Perry", rawTitle: "Katy Perry - Roar (Lyrics)" }),
      20
    )
  })
})
