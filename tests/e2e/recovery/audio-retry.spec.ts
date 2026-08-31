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

const brokenPreviewTrack = {
  source: "spotify" as const,
  uri: "spotify:preview-broken",
  name: "Preview Broken Song",
  artists: "Preview Artist",
  duration_ms: 180_000,
  albumImage: null,
  preview_url: "https://example.test/preview.mp3",
  audioStartSeconds: 42,
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
          window.__ytEvents = { seeks: [] };
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
            seekTo(seconds) { window.__ytEvents.seeks.push({ videoId: this.videoId, seconds }); }
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

async function mockYouTubeScriptRetry(page: Page) {
  let attempts = 0
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    attempts += 1
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: "text/plain", body: "provider unavailable" })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (() => {
          class MockPlayer {
            constructor(id, config) {
              this.config = config;
              setTimeout(() => config.events?.onReady?.({ target: this }), 0);
            }
            cueVideoById() {}
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

test("@resilience falls back to verified YouTube when a Spotify preview expires", async ({ page }) => {
  await page.addInitScript(() => {
    window.HTMLMediaElement.prototype.play = () => Promise.reject(new Error("preview expired"))
  })
  await mockYouTubeWithFailure(page, "never-fails")
  await seedGame(page, [brokenPreviewTrack], {
    ...activeSession,
    id: "spotify-preview-fallback",
    runId: "spotify-preview-fallback-run",
    playlistSource: "spotify",
  })
  await page.route("**/api/youtube/search?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        videoId: "previewfb12",
        sourceType: "official_audio",
        rawTitle: "Preview Artist - Preview Broken Song (Official Audio)",
      }),
    })
  })

  await page.goto("/game")
  await page.getByLabel("Play preview").click()
  await expect(page.getByTestId("audio-retry")).toBeVisible()
  await page.getByTestId("audio-retry").click()

  await expect(page.getByLabel("Play preview")).toBeVisible()
  await expect(page.getByTestId("audio-retry")).toHaveCount(0)
  await page.getByLabel("Play preview").click()
  await expect
    .poll(() => page.evaluate(() => (window as any).__ytEvents?.seeks ?? []))
    .toContainEqual({ videoId: "previewfb12", seconds: 0 })
})

test("@resilience retries a failed YouTube iframe script once", async ({ page }) => {
  await mockYouTubeScriptRetry(page)
  await seedGame(page, [brokenTrack], {
    ...activeSession,
    id: "youtube-script-retry",
    runId: "youtube-script-retry-run",
  })
  await page.route("**/api/youtube/search?*", async (route) => {
    const url = new URL(route.request().url())
    expect(url.searchParams.getAll("excludeVideoId")).toContain("broken12")
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        videoId: "scriptfb12",
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
