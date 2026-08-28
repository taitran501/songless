import { expect, test } from "@playwright/test"

test("@sharing copies a completed run without revealing the answer", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(value: string) {
          ;(window as any).__shareText = value
          return Promise.resolve()
        },
      },
    })
  })
  await page.addInitScript(() => {
    const tracks = [{
      source: "youtube",
      uri: "youtube:sharing-track",
      videoId: "sharing-track",
      name: "Sharing Answer",
      artists: "Sharing Artist",
      duration_ms: 180000,
      albumImage: null,
      preview_url: null,
      lyricsSnippets: [
        "A quiet morning beside the river and distant clouds",
        "Silver river beneath the wide open sky tonight",
        "Violet skyline after the rain across the city",
      ],
    }]
    localStorage.setItem("game_tracks", JSON.stringify(tracks))
    localStorage.setItem("full_playlist_tracks", JSON.stringify(tracks))
    localStorage.setItem("songless_session_v2", JSON.stringify({
      kind: "lyrics",
      playbackMode: "lyrics",
      id: "sharing-fixture",
      runId: "sharing-fixture-run",
      status: "active",
      startedAt: "2026-08-27T00:00:00.000Z",
    }))
  })

  await page.goto("/game")
  await page.getByPlaceholder("Know the song? Search title...").fill("Sharing Answer")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByRole("heading", { name: /SOLVED/i })).toBeVisible()
  await page.getByRole("button", { name: "VIEW SUMMARY" }).click()
  await expect(page.getByText("Final Score")).toBeVisible()
  await page.getByRole("button", { name: "SHARE RUN" }).click()

  await expect(page.getByText("Run copied!", { exact: true })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => (window as any).__shareText as string))
    .not.toContain("Sharing Answer")
})
