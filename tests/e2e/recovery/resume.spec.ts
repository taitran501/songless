import { expect, test, type Page } from "@playwright/test"

const playlistTracks = [
  { source: "spotify", uri: "spotify:playlist-one", name: "Playlist One", artists: "Playlist Artist", duration_ms: 180000, albumImage: null, preview_url: "https://example.test/preview.mp3" },
  { source: "youtube", uri: "youtube:playlist-two", videoId: "playlist-two", name: "Playlist Two", artists: "Playlist Artist", duration_ms: 180000, albumImage: null, preview_url: null },
]

async function seedGame(page: Page, tracks: unknown[], session: Record<string, unknown>) {
  await page.addInitScript(({ nextTracks, nextSession }) => {
    localStorage.setItem("game_tracks", JSON.stringify(nextTracks))
    localStorage.setItem("full_playlist_tracks", JSON.stringify(nextTracks))
    localStorage.setItem("songless_session_v2", JSON.stringify({ status: "active", startedAt: "2026-08-27T00:00:00.000Z", ...nextSession }))
  }, { nextTracks: tracks, nextSession: session })
}

async function mockYouTubeIframe(page: Page) {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: `(() => { class Player { constructor(id, config) { setTimeout(() => config.events?.onReady?.({ target: this }), 0); } cueVideoById() {} seekTo() {} playVideo() {} pauseVideo() {} stopVideo() {} unMute() {} setVolume() {} } window.YT = { Player }; setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0); })();` })
  })
}

const activePlaylistSession = { kind: "playlist", playbackMode: "audio", id: "playlist-fixture", runId: "playlist-fixture-run", playlistSource: "spotify" }

test("@resilience restores a non-resolved round after refresh", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedGame(page, playlistTracks, activePlaylistSession)
  await page.goto("/game")

  await page.getByPlaceholder(/Know the song\?/).fill("not the answer")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByText("2 / 6")).toBeVisible()

  await page.reload()
  await expect(page.getByText("Track 1 of 2")).toBeVisible()
  await expect(page.getByText("2 / 6")).toBeVisible()
})

test("@resilience keeps the result checkpoint recoverable after refresh", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedGame(page, [playlistTracks[0]], {
    ...activePlaylistSession,
    id: "playlist-modal-fixture",
    runId: "playlist-modal-fixture-run",
  })
  await page.goto("/game")

  await page.getByPlaceholder(/Know the song\?/).fill(playlistTracks[0].name)
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByRole("heading", { name: /SOLVED/i })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("heading", { name: /SOLVED/i })).toBeVisible()
})

test("@resilience keeps a failed result checkpoint recoverable after refresh", async ({ page }) => {
  await seedGame(page, [playlistTracks[0]], {
    ...activePlaylistSession,
    id: "playlist-failed-modal-fixture",
    runId: "playlist-failed-modal-fixture-run",
  })
  await page.goto("/game")

  for (let index = 0; index < 6; index += 1) {
    await page.getByPlaceholder(/Know the song\?/).fill(`wrong answer ${index}`)
    await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  }
  await expect(page.getByRole("heading", { name: /TRACK FAILED/i })).toBeVisible()
  await expect(page.getByText("Attempts Used")).toBeVisible()
  await expect(page.getByText(/run continues with the next song/i)).toBeVisible()

  await page.reload()
  await expect(page.getByRole("heading", { name: /TRACK FAILED/i })).toBeVisible()
})

test("@resilience clears a modal checkpoint that does not match saved results", async ({ page }) => {
  const runId = "playlist-invalid-modal-run"
  await seedGame(page, [playlistTracks[0]], {
    ...activePlaylistSession,
    id: "playlist-invalid-modal-fixture",
    runId,
  })
  await page.addInitScript(({ modalKey }) => {
    localStorage.setItem(
      modalKey,
      JSON.stringify({
        correct: true,
        trackId: "not-the-current-track",
        guesses: ["wrong", "answer"],
        trackIndex: 0,
        pointsEarned: 80,
      })
    )
  }, { modalKey: `songless_modal_${runId}` })

  await page.goto("/game")
  await expect(page.getByRole("heading", { name: /SOLVED|GAME OVER/i })).toHaveCount(0)
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), `songless_modal_${runId}`))
    .toBeNull()
})
