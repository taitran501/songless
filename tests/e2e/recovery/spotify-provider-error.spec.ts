import { expect, test } from "@playwright/test"

test("@resilience distinguishes Spotify provider denial from a private playlist", async ({ page }) => {
  await page.route("**/api/spotify/playlist?playlistId=providerdenied123", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "Spotify denied access to this request. The playlist may be private, or Spotify access is not enabled for this deployment.",
        code: "spotify_provider_unavailable",
      }),
    })
  })

  await page.goto("/playlist")
  const input = page.getByPlaceholder("https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=...")
  await input.fill("providerdenied123")
  await page.getByTestId("load-playlist").click()

  await expect(page.getByTestId("playlist-load-error")).toContainText(/Spotify is currently unavailable/i)
  await expect(page.getByTestId("playlist-loaded")).toHaveCount(0)
})
