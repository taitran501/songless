import { expect, test, type Page } from "@playwright/test"

const playlistTracks = [
  { source: "spotify", uri: "spotify:playlist-one", name: "Playlist One", artists: "Playlist Artist", duration_ms: 180000, albumImage: null, preview_url: "https://example.test/preview.mp3" },
  { source: "youtube", uri: "youtube:playlist-two", videoId: "playlist-two", name: "Playlist Two", artists: "Playlist Artist", duration_ms: 180000, albumImage: null, preview_url: null },
]
const activePlaylistSession = { kind: "playlist", playbackMode: "audio", id: "playlist-fixture", runId: "playlist-fixture-run", playlistSource: "spotify" }

async function seedGame(page: Page) {
  await page.addInitScript(({ nextTracks, nextSession }) => {
    localStorage.setItem("game_tracks", JSON.stringify(nextTracks))
    localStorage.setItem("full_playlist_tracks", JSON.stringify(nextTracks))
    localStorage.setItem("songless_session_v2", JSON.stringify({ status: "active", startedAt: "2026-08-27T00:00:00.000Z", ...nextSession }))
  }, { nextTracks: playlistTracks, nextSession: activePlaylistSession })
}

async function seedCustomGame(page: Page) {
  const tracks = [
    {
      source: "spotify" as const,
      uri: "spotify:ambiguous-home",
      name: "Home",
      artists: "Artist A",
      duration_ms: 180000,
      albumImage: null,
      preview_url: "https://example.test/preview.mp3",
    },
  ]
  const session = {
    ...activePlaylistSession,
    id: "ambiguous-home",
    runId: "ambiguous-home-run",
  }
  await page.addInitScript(({ nextTracks, nextSession }) => {
    localStorage.setItem("game_tracks", JSON.stringify(nextTracks))
    localStorage.setItem("full_playlist_tracks", JSON.stringify(nextTracks))
    localStorage.setItem(
      "songless_session_v2",
      JSON.stringify({ status: "active", startedAt: "2026-08-27T00:00:00.000Z", ...nextSession })
    )
  }, { nextTracks: tracks, nextSession: session })
}

test("@resilience prioritizes suggestions from the active playlist", async ({ page }) => {
  await seedGame(page)
  await page.route("**/api/youtube/suggestions?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          uri: "youtube:unrelated",
          name: "Unrelated Result",
          artists: "Other Artist",
          albumImage: null,
        },
      ]),
    })
  })
  await page.goto("/game")
  await expect(page.getByText("Track 1 of 2")).toBeVisible()

  await page.getByPlaceholder(/Know the song\?/).fill("Playlist One")
  await expect(page.getByTestId("guess-action-panel").locator("button").first()).toContainText("Playlist One")
})

test("@resilience rejects a same-title suggestion from a different artist", async ({ page }) => {
  await seedCustomGame(page)
  await page.route("**/api/youtube/suggestions?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { uri: "youtube:home-artist-b", name: "Home", artists: "Artist B", albumImage: null },
      ]),
    })
  })

  await page.goto("/game")
  await page.getByPlaceholder(/Know the song\?/).fill("Artist B Home")
  const wrongSuggestion = page
    .getByTestId("guess-action-panel")
    .locator("button")
    .filter({ hasText: "Home" })
  await expect(wrongSuggestion).toBeVisible()
  await wrongSuggestion.click()
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()

  await expect(page.getByRole("heading", { name: /SOLVED/i })).toHaveCount(0)
  await expect(page.getByText("2 / 6")).toBeVisible()
})

test("@resilience dedupes related suggestions and allows submit while the dropdown is open", async ({ page }) => {
  await seedCustomGame(page)
  await page.route("**/api/youtube/suggestions?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { uri: "youtube:home-official", name: "Home", artists: "Artist A", albumImage: null },
        { uri: "youtube:home-lyrics", name: "Home", artists: "Artist A", albumImage: null },
        { uri: "youtube:abc-news", name: "ABC News", artists: "World Broadcast", rawTitle: "ABC News live broadcast", albumImage: null },
      ]),
    })
  })

  await page.goto("/game")
  await page.getByPlaceholder(/Know the song\?/).fill("Home")
  await expect(page.getByTestId("guess-suggestion")).toHaveCount(1)

  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByRole("heading", { name: /SOLVED/i })).toBeVisible()
})
