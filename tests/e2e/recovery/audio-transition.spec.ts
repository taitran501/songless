import { expect, test, type Page } from "@playwright/test"

const transitionTracks = [
  {
    source: "youtube" as const,
    uri: "youtube:transition-first",
    videoId: "transition-first",
    name: "Transition First",
    artists: "Transition Artist",
    duration_ms: 180_000,
    albumImage: null,
    preview_url: null,
  },
  {
    source: "youtube" as const,
    uri: "youtube:transition-second",
    videoId: "transition-second",
    name: "Transition Second",
    artists: "Transition Artist",
    duration_ms: 180_000,
    albumImage: null,
    preview_url: null,
  },
]

const session = {
  kind: "playlist" as const,
  playbackMode: "audio" as const,
  id: "audio-transition-fixture",
  runId: "audio-transition-fixture-run",
  playlistSource: "youtube" as const,
}

async function seedGame(page: Page, tracks: unknown[], nextSession: Record<string, unknown>) {
  await page.addInitScript(({ nextTracks, session }) => {
    localStorage.setItem("game_tracks", JSON.stringify(nextTracks))
    localStorage.setItem("full_playlist_tracks", JSON.stringify(nextTracks))
    localStorage.setItem(
      "songless_session_v2",
      JSON.stringify({ status: "active", startedAt: "2026-08-27T00:00:00.000Z", ...session })
    )
  }, { nextTracks: tracks, session: nextSession })
}

async function mockYouTubeIframe(page: Page) {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `(() => {
        window.__ytEvents = { created: [], destroyed: [] };
        class MockPlayer {
          constructor(id, config) {
            this.config = config;
            this.videoId = config.videoId;
            window.__ytEvents.created.push(config.videoId);
            setTimeout(() => config.events?.onReady?.({ target: this }), 0);
          }
          stopVideo() {}
          destroy() { window.__ytEvents.destroyed.push(this.videoId); }
          cueVideoById(videoId) { this.videoId = videoId; }
          unMute() {}
          setVolume() {}
          seekTo() {}
          playVideo() {}
          pauseVideo() {}
        }
        window.YT = { Player: MockPlayer };
        setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0);
      })();`,
    })
  })
}

test("@resilience replaces the YouTube player when advancing to the next track", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedGame(page, transitionTracks, session)
  await page.goto("/game")

  await expect(page.getByTestId("audio-play-button")).toBeEnabled()
  await page.getByPlaceholder(/Know the song\?/).fill("Transition First")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByRole("heading", { name: /SOLVED/i })).toBeVisible()
  await page.getByRole("button", { name: "NEXT SONG" }).click()

  await expect(page.getByText("Track 2 of 2")).toBeVisible()
  await expect(page.getByTestId("audio-play-button")).toBeEnabled({ timeout: 5_000 })
  await expect
    .poll(() => page.evaluate(() => (window as any).__ytEvents?.created ?? []))
    .toContain("transition-second")
  await expect
    .poll(() => page.evaluate(() => (window as any).__ytEvents?.destroyed ?? []))
    .toContain("transition-first")
})

test("@resilience exposes Skip when YouTube player initialization times out", async ({ page }) => {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `(() => {
        window.__ytEvents = { created: [] };
        class HangingPlayer {
          constructor(id, config) {
            this.config = config;
            window.__ytEvents.created.push(config.videoId);
          }
          destroy() {}
          stopVideo() {}
        }
        window.YT = { Player: HangingPlayer };
        setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0);
      })();`,
    })
  })
  await seedGame(page, [transitionTracks[0]], {
    ...session,
    id: "audio-timeout-fixture",
    runId: "audio-timeout-fixture-run",
  })
  await page.goto("/game")

  await expect(page.getByTestId("audio-error")).toContainText(/in time|Try again/i, {
    timeout: 15_000,
  })
  await expect(page.getByTestId("audio-play-button")).toBeDisabled()
  await expect(page.getByRole("button", { name: /SKIP|REVEAL ANSWER/ })).toBeEnabled()
})
