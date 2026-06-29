import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseYouTubePlaylistHtml } from "@/lib/youtube"

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
  it("parses lockup playlist HTML", () => {
    const result = parseYouTubePlaylistHtml(html)

    assert.equal(result.playlistName, "Fixture Playlist")
    assert.equal(result.tracks.length, 1)
    assert.equal(result.tracks[0].source, "youtube")
    assert.equal(result.tracks[0].videoId, "6uVJqD2hSGQ")
    assert.equal(result.tracks[0].duration_ms, 296000)
  })
})
