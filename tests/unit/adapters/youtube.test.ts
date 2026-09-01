import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getYouTubeAudioCacheKey,
  getYouTubeSourceType,
  extractYouTubePlaylistId,
  isYouTubePlaylistInput,
  parseYouTubePlaylistHtml,
  parseYouTubeSearchHtml,
  resolveYouTubeAudioSourceFromSuggestions,
  shouldRetryCachedYouTubeSource,
} from "@/lib/youtube"

const html = `
<html><script>
var ytInitialData = {
  "metadata": {
    "playlistMetadataRenderer": {
      "title": "Fixture Playlist"
    }
  },
  "contents": {
    "twoColumnBrowseResultsRenderer": {
      "tabs": [{
        "tabRenderer": {
          "content": {
            "sectionListRenderer": {
              "contents": [{
                "itemSectionRenderer": {
                  "contents": [{
                    "lockupViewModel": {
                      "contentType": "LOCKUP_CONTENT_TYPE_VIDEO",
                      "contentId": "6uVJqD2hSGQ",
                      "metadata": {
                        "lockupMetadataViewModel": {
                          "title": { "content": "Fixture Song" },
                          "metadata": {
                            "contentMetadataViewModel": {
                              "metadataRows": [{
                                "metadataParts": [{
                                  "text": { "content": "Fixture Artist" }
                                }]
                              }]
                            }
                          }
                        }
                      },
                      "contentImage": {
                        "thumbnailViewModel": {
                          "image": {
                            "sources": [{ "url": "https://example.test/thumb.jpg" }]
                          },
                          "overlays": [{
                            "thumbnailBottomOverlayViewModel": {
                              "badges": [{
                                "thumbnailBadgeViewModel": { "text": "4:56" }
                              }]
                            }
                          }]
                        }
                      }
                    }
                  }]
                }
              }]
            }
          }
        }
      }]
    }
  }
};</script></html>`

describe("YouTube parser", () => {
  it("builds a stable cache key and limits cached-source retry", () => {
    assert.equal(
      getYouTubeAudioCacheKey("youtube:Track:ABC"),
      "songless_yt_cache_youtube%3Atrack%3Aabc"
    )
    assert.equal(shouldRetryCachedYouTubeSource("cached", 0), true)
    assert.equal(shouldRetryCachedYouTubeSource("cached", 1), false)
    assert.equal(shouldRetryCachedYouTubeSource("resolved", 0), false)
    assert.equal(shouldRetryCachedYouTubeSource("direct", 0), false)
  })

  it("accepts only YouTube playlist URLs or recognized playlist IDs", () => {
    assert.equal(
      extractYouTubePlaylistId("https://www.youtube.com/playlist?list=PLyoutubeplaylist1234567"),
      "PLyoutubeplaylist1234567"
    )
    assert.equal(isYouTubePlaylistInput("PLyoutubeplaylist1234567"), true)
    assert.equal(isYouTubePlaylistInput("https://evil-youtube.com/playlist?list=PLyoutubeplaylist1234567"), false)
    assert.equal(
      isYouTubePlaylistInput(["https://open.", "spotify.com/playlist/legacy123"].join("")),
      false
    )
  })

  it("parses lockup playlist HTML", () => {
    const result = parseYouTubePlaylistHtml(html)

    assert.equal(result.playlistName, "Fixture Playlist")
    assert.equal(result.tracks.length, 1)
    assert.equal(result.tracks[0].source, "youtube")
    assert.equal(result.tracks[0].videoId, "6uVJqD2hSGQ")
    assert.equal(result.tracks[0].duration_ms, 296000)
  })

  it("parses and cleans YouTube search suggestions", () => {
    const html = `<html><script>var ytInitialData = ${JSON.stringify({
      contents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: [
                  {
                    videoRenderer: {
                      videoId: "6uVJqD2hSGQ",
                      title: { runs: [{ text: "Binz - Em (Official Music Video)" }] },
                      ownerText: { runs: [{ text: "Binz Official" }] },
                      thumbnail: {
                        thumbnails: [{ url: "https://i.ytimg.com/vi/6uVJqD2hSGQ/hqdefault.jpg" }],
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    })};</script></html>`

    const [suggestion] = parseYouTubeSearchHtml(html)

    assert.equal(suggestion.uri, "youtube:6uVJqD2hSGQ")
    assert.equal(suggestion.name, "Em")
    assert.equal(suggestion.artists, "Binz")
  })

  it("prefers a verified official source", () => {
    const match = resolveYouTubeAudioSourceFromSuggestions(
      { title: "Em", artists: "Binz" },
      [
        {
          videoId: "cover123456",
          uri: "youtube:cover123456",
          name: "Em",
          artists: "Random Singer",
          albumImage: null,
          rawTitle: "Em - Binz cover by Random Singer",
        },
        {
          videoId: "official123",
          uri: "youtube:official123",
          name: "Em",
          artists: "Binz",
          albumImage: null,
          rawTitle: "Binz - Em (Official Audio)",
        },
      ]
    )

    assert.equal(match?.videoId, "official123")
    assert.ok((match?.matchScore || 0) > 100)
  })

  it("rejects live, remix, cover and artist mismatches", () => {
    const match = resolveYouTubeAudioSourceFromSuggestions(
      { title: "Em", artists: "Binz" },
      [
        {
          videoId: "live1234567",
          uri: "youtube:live1234567",
          name: "Em",
          artists: "Binz",
          albumImage: null,
          rawTitle: "Binz - Em live",
        },
        {
          videoId: "remix12345",
          uri: "youtube:remix12345",
          name: "Em",
          artists: "Binz",
          albumImage: null,
          rawTitle: "Binz - Em remix",
        },
        {
          videoId: "wrong123456",
          uri: "youtube:wrong123456",
          name: "Em",
          artists: "Different Artist",
          albumImage: null,
          rawTitle: "Different Artist - Em official audio",
        },
      ]
    )

    assert.equal(match, null)
  })

  it("rejects a same-title result when the artist identity is different", () => {
    const match = resolveYouTubeAudioSourceFromSuggestions(
      { title: "Home", artists: "Artist A" },
      [
        {
          videoId: "homeartistb",
          uri: "youtube:homeartistb",
          name: "Home",
          artists: "Artist B",
          albumImage: null,
          rawTitle: "Artist B - Home (Official Audio)",
        },
      ]
    )

    assert.equal(match, null)
  })

  it("excludes a failed video and derives source type from the raw title", () => {
    const match = resolveYouTubeAudioSourceFromSuggestions(
      { title: "Home", artists: "Artist A", excludeVideoIds: ["homebad"] },
      [
        {
          videoId: "homebad",
          uri: "youtube:homebad",
          name: "Home",
          artists: "Artist A",
          albumImage: null,
          rawTitle: "Artist A - Home (Official Audio)",
        },
        {
          videoId: "homegood",
          uri: "youtube:homegood",
          name: "Home",
          artists: "Artist A",
          albumImage: null,
          rawTitle: "Artist A - Home (Official Music Video)",
        },
      ]
    )

    assert.equal(match?.videoId, "homegood")
    assert.equal(match?.sourceType, "music_video")
    assert.equal(getYouTubeSourceType("Artist A - Home live performance"), "performance")
    assert.equal(getYouTubeSourceType("Artist A - Home"), "unknown")
  })
})
