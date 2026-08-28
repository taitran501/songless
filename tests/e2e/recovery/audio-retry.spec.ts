import { expect, test, type Page } from "@playwright/test"

const brokenTrack = {
  source: "youtube" as const,
  uri: "youtube:broken12",
  videoId: "broken12",
  name: "Broken Song",
  artists: "Broken Artist",
  duration_ms: 180_000,
  albumImage: null,
  preview_url: null,
}

const activeSession = {
  kind: "playlist" as const,
  playbackMode: "audio" as const,
  id: "audio-retry-fixture",
  runId: "audio-retry-fixture-run",
  playlistSource: "youtube" as const,
}

async function seedGame(page: Page, tracks: unknown[], session: Record<string, unknown>) {
  await page.addInitScript(({ nextTracks, nextSession }) => {
    localStorage.setItem("game_tracks", JSON.stringify(nextTracks))
    localStorage.setItem("full_playlist_tracks", JSON.stringify(nextTracks))
    localStorage.setItem(
      "songless_session_v2",
      JSON.stringify({ status: "active", startedAt: "2026-08-27T00:00:00.000Z", ...nextSession })
    )
  }, { nextTracks: tracks, nextSession: session })
}

async function mockYouTubeWithFailure(page: Page, failingVideoId: string) {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (() => {
          class MockPlayer {
            constructor(id, config) {
              this.config = config;
              this.videoId = config.videoId;
              setTimeout(() => {
                config.events?.onReady?.({ target: this });
                if (this.videoId === ${JSON.stringify(failingVideoId)}) {
                  setTimeout(() => config.events?.onError?.({ target: this, data: 150 }), 10);
                }
              }, 0);
            }
            cueVideoById(videoId) { this.videoId = videoId; }
            seekTo() {}
            playVideo() {}
            pauseVideo() {}
            stopVideo() {}
            destroy() {}
            unMute() {}
            setVolume() {}
          }
          window.YT = { Player: MockPlayer };
          setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0);
        })();
      `,
    })
  })
}

test("@resilience recovers from an unavailable direct YouTube source", async ({ page }) => {
  await mockYouTubeWithFailure(page, "broken12")
  await seedGame(page, [brokenTrack], activeSession)
  await page.route("**/api/youtube/search?*", async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.getAll("excludeVideoId")).toContain("broken12")
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        videoId: "fallback12",
        sourceType: "official_audio",
        rawTitle: "Broken Artist - Broken Song (Official Audio)",
      }),
    })
  })

  await page.goto("/game")
  await expect(page.getByTestId("audio-retry")).toBeVisible()
  await page.getByTestId("audio-retry").click()

  await expect(page.getByLabel("Play preview")).toBeVisible()
  await expect(page.getByTestId("audio-retry")).toHaveCount(0)
})

test("@resilience keeps Skip available after the one audio fallback is exhausted", async ({ page }) => {
  await mockYouTubeWithFailure(page, "broken12")
  await seedGame(page, [brokenTrack], {
    ...activeSession,
    id: "audio-retry-exhausted",
    runId: "audio-retry-exhausted-run",
  })
  await page.route("**/api/youtube/search?*", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "No verified fallback" }),
    })
  })

  await page.goto("/game")
  await page.getByTestId("audio-retry").click()

  await expect(page.getByText(/No playable audio source was found/i)).toBeVisible()
  await expect(page.getByTestId("audio-retry")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /SKIP/ })).toBeEnabled()
  await expect(page.getByPlaceholder(/Know the song\?/)).toBeEnabled()
})
