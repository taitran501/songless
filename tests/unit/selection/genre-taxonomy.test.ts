import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyChartGenre, isRapGenreMetadata } from "@/lib/genre-taxonomy"

describe("strict chart genre taxonomy", () => {
  it("uses provider metadata before local allowlist", () => {
    const result = classifyChartGenre({
      name: "Unknown Single",
      artists: "Unknown Artist",
      region: "us",
      providerGenres: ["hip-hop", "rap"],
    })

    assert.deepEqual(result, { genre: "rap", evidence: "provider", confidence: 0.98 })
  })

  it("never labels a country chart entry as Rap", () => {
    const result = classifyChartGenre({
      name: "I'm The Problem",
      artists: "Morgan Wallen",
      region: "us",
      providerGenres: ["country"],
    })

    assert.equal(result?.genre, "usuk")
    assert.notEqual(result?.genre, "rap")
    assert.equal(isRapGenreMetadata(["country"]), false)
  })

  it("drops an unclassified chart candidate instead of guessing from region", () => {
    assert.equal(
      classifyChartGenre({
        name: "Unknown Single",
        artists: "Unknown Artist",
        region: "us",
      }),
      null
    )
    assert.equal(
      classifyChartGenre({
        name: "Imported Pop Single",
        artists: "Unknown Artist",
        region: "vn",
        providerGenres: ["pop"],
      }),
      null
    )
  })

  it("matches whole genre words instead of substrings", () => {
    assert.equal(isRapGenreMetadata(["grape"]), false)
    assert.equal(isRapGenreMetadata(["Hip-Hop/Rap"]), true)
  })
})
