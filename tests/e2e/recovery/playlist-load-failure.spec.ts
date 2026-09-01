import { expect, test } from "@playwright/test"

const loadedTrack = {
  source: "youtube" as const,
  uri: "youtube:loaded-playlist-track",
  videoId: "loaded-playlist-track",
  name: "Loaded Playlist Song",
  artists: "Playlist Artist",
  duration_ms: 180_000,
  albumImage: null,
  preview_url: null,
}

test("@resilience clears a previously loaded playlist when a new load fails", async ({ page }) => {
  await page.route("**/api/youtube/playlist?url=*", async (route) => {
    const playlistId = new URL(route.request().url()).searchParams.get("url")
    if (playlistId === "PLgoodplaylist12345678") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-playlist-name": encodeURIComponent("Good Playlist") },
        body: JSON.stringify([loadedTrack]),
      })
      return
    }

    if (playlistId === "PLmalformedplaylist1234") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tracks: "not-an-array" }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Playlist is private or unavailable" }),
    })
  })

  await page.goto("/playlist")
  const input = page.getByPlaceholder("https://www.youtube.com/playlist?list=...")
  await input.fill("PLgoodplaylist12345678")
  await page.getByTestId("load-playlist").click()

  await expect(page.getByTestId("playlist-loaded")).toBeVisible()
  await expect(page.getByTestId("loaded-playlist-name")).toHaveText("Good Playlist")
  await expect(page.getByTestId("loaded-playlist-source")).toContainText("YouTube")
  await expect(page.getByTestId("start-playlist-game")).toBeEnabled()

  await input.fill("PLbadplaylist12345678")
  await page.getByTestId("load-playlist").click()

  await expect(page.getByTestId("playlist-load-error")).toContainText(/private or unavailable/i)
  await expect(page.getByTestId("playlist-loaded")).toHaveCount(0)
  await expect(page.getByTestId("start-playlist-game")).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => ({
      tracks: localStorage.getItem("game_tracks"),
      full: localStorage.getItem("full_playlist_tracks"),
    })))
    .toEqual({ tracks: "[]", full: null })

  await input.fill("not-a-playlist-url")
  await page.getByTestId("load-playlist").click()
  await expect(page.getByTestId("playlist-load-error")).toContainText(/valid YouTube playlist/i)

  await input.fill("PLmalformedplaylist1234")
  await page.getByTestId("load-playlist").click()
  await expect(page.getByTestId("playlist-load-error")).toContainText(/load this playlist/i)
  await expect(page.getByTestId("playlist-loaded")).toHaveCount(0)
})

test("@resilience does not expose non-playlist tracks as a loaded playlist", async ({ page }) => {
  await page.addInitScript(({ track }) => {
    window.localStorage.setItem("game_tracks", JSON.stringify([track]))
    window.localStorage.setItem("full_playlist_tracks", JSON.stringify([track]))
    window.localStorage.setItem(
      "songless_session_v2",
      JSON.stringify({
        kind: "genre",
        playbackMode: "audio",
        id: "genre-vpop",
        runId: "genre-vpop-run",
        genre: "vpop",
        status: "active",
        startedAt: "2026-08-27T00:00:00.000Z",
      })
    )
  }, { track: loadedTrack })

  await page.goto("/playlist")

  await expect(page.getByTestId("playlist-loaded")).toHaveCount(0)
  await expect(page.getByTestId("start-playlist-game")).toHaveCount(0)
})

test("@playlist rejects retired provider URLs without a provider request", async ({ page }) => {
  let retiredProviderRequest = false
  const retiredPlaylistUrl = ["https://open.", "spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"].join("")
  await page.on("request", (request) => {
    if (request.url().includes(["/api/", "spotify", "/"].join(""))) retiredProviderRequest = true
  })

  await page.goto("/playlist")
  const input = page.getByPlaceholder("https://www.youtube.com/playlist?list=...")
  await input.fill(retiredPlaylistUrl)
  await page.getByTestId("load-playlist").click()

  await expect(page.getByTestId("playlist-load-error")).toContainText(
    "Enter a valid YouTube playlist URL or playlist ID."
  )
  expect(retiredProviderRequest).toBe(false)
  await expect(page.getByTestId("start-playlist-game")).toHaveCount(0)
})

test("@playlist hides and persists-clean legacy recent playlist entries", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "recent_playlists",
      JSON.stringify([
        { id: "https://open.spotify.com/playlist/legacy123", name: "Legacy provider", trackCount: 2 },
        { id: "PLrecentyoutube1234567", name: "YouTube Mix", trackCount: 3 },
      ])
    )
  })

  await page.goto("/playlist")
  await expect(page.getByText("YouTube Mix", { exact: true })).toBeVisible()
  await expect(page.getByText("Legacy provider", { exact: true })).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("recent_playlists") || "[]")))
    .toEqual([
      { id: "PLrecentyoutube1234567", name: "YouTube Mix", trackCount: 3, source: "youtube" },
    ])
})
