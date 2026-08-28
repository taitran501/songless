import { expect, test } from "@playwright/test"

const loadedTrack = {
  source: "spotify" as const,
  uri: "spotify:loaded-playlist-track",
  name: "Loaded Playlist Song",
  artists: "Playlist Artist",
  duration_ms: 180_000,
  albumImage: null,
  preview_url: "https://example.test/preview.mp3",
}

test("@resilience clears a previously loaded playlist when a new load fails", async ({ page }) => {
  await page.route("**/api/spotify/playlist?playlistId=*", async (route) => {
    const playlistId = new URL(route.request().url()).searchParams.get("playlistId")
    if (playlistId === "goodplaylist123") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-playlist-name": encodeURIComponent("Good Playlist") },
        body: JSON.stringify([loadedTrack]),
      })
      return
    }

    if (playlistId === "malformedplaylist") {
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
  const input = page.getByPlaceholder("https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=...")
  await input.fill("goodplaylist123")
  await page.getByTestId("load-playlist").click()

  await expect(page.getByTestId("playlist-loaded")).toBeVisible()
  await expect(page.getByTestId("loaded-playlist-name")).toHaveText("Good Playlist")
  await expect(page.getByTestId("loaded-playlist-source")).toContainText("Spotify")
  await expect(page.getByTestId("start-playlist-game")).toBeEnabled()

  await input.fill("badplaylist456")
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
  await expect(page.getByTestId("playlist-load-error")).toContainText(/valid YouTube playlist|public Spotify playlist/i)

  await input.fill("malformedplaylist")
  await page.getByTestId("load-playlist").click()
  await expect(page.getByTestId("playlist-load-error")).toContainText(/load this playlist/i)
  await expect(page.getByTestId("playlist-loaded")).toHaveCount(0)
})
