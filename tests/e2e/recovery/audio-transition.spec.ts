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
        window.__ytEvents = { created: [], destroyed: [], createdDialogCounts: [] };
        class MockPlayer {
          constructor(id, config) {
            this.config = config;
            this.videoId = config.videoId;
            this.mount = typeof id === "string" ? document.getElementById(id) : id;
            const iframe = document.createElement("iframe");
            iframe.title = config.videoId + " answer leak";
            this.mount?.appendChild(iframe);
            window.__ytEvents.created.push(config.videoId);
            window.__ytEvents.createdDialogCounts.push({
              videoId: config.videoId,
              dialogCount: document.querySelectorAll('[role="dialog"]').length,
            });
            setTimeout(() => config.events?.onReady?.({ target: this }), 0);
          }
          stopVideo() {}
          destroy() {
            window.__ytEvents.destroyed.push(this.videoId);
            setTimeout(() => this.mount?.replaceChildren(), 25);
          }
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
  const pageErrors: string[] = []
  const consoleMessages: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      consoleMessages.push(message.text())
    }
  })
  await mockYouTubeIframe(page)
  await seedGame(page, transitionTracks, session)
  await page.goto("/game")

  await expect(page.getByTestId("audio-play-button")).toBeEnabled()
  const hostBounds = await page.getByTestId("youtube-player-host").evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  })
  expect(hostBounds.width).toBeLessThanOrEqual(1)
  expect(hostBounds.height).toBeLessThanOrEqual(1)
  expect(hostBounds.left).toBeLessThan(0)
  expect(hostBounds.top).toBeLessThan(0)
  await page.getByPlaceholder(/Know the song\?/).fill("Transition First")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByRole("heading", { name: /SOLVED/i })).toBeVisible()
  await page.getByRole("button", { name: "NEXT SONG" }).click()

  await expect(page.getByTestId("game-result-modal")).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText("Track 2 of 2")).toBeVisible()
  await expect(page.getByTestId("audio-play-button")).toBeEnabled({ timeout: 5_000 })
  await expect
    .poll(() => page.evaluate(() => (window as any).__ytEvents?.created ?? []))
    .toContain("transition-second")
  await expect
    .poll(() => page.evaluate(() => (window as any).__ytEvents?.destroyed ?? []))
    .toContain("transition-first")
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__ytEvents?.createdDialogCounts?.find(
            (entry: { videoId: string }) => entry.videoId === "transition-second"
          )?.dialogCount ?? null
      )
    )
    .toBe(0)
  expect(pageErrors.join("\n")).not.toMatch(/removeChild|Application error/i)
  expect(consoleMessages.join("\n")).not.toMatch(/not attached to the DOM/i)
})

test("@resilience closes a failed result before advancing to the next track", async ({ page }) => {
  const pageErrors: string[] = []
  const consoleMessages: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      consoleMessages.push(message.text())
    }
  })
  await mockYouTubeIframe(page)
  await seedGame(page, transitionTracks, {
    ...session,
    id: "audio-failed-transition-fixture",
    runId: "audio-failed-transition-fixture-run",
  })
  await page.goto("/game")

  await expect(page.getByTestId("audio-play-button")).toBeEnabled()
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.getByPlaceholder(/Know the song\?/).fill(`wrong answer ${attempt}`)
    await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  }
  await expect(page.getByRole("heading", { name: /TRACK FAILED/i })).toBeVisible()
  await page.getByRole("button", { name: "NEXT SONG" }).click()

  await expect(page.getByTestId("game-result-modal")).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText("Track 2 of 2")).toBeVisible()
  await expect(page.getByTestId("audio-play-button")).toBeEnabled({ timeout: 5_000 })
  await expect
    .poll(() => page.evaluate(() => (window as any).__ytEvents?.created ?? []))
    .toContain("transition-second")
  await expect
    .poll(() => page.evaluate(() => (window as any).__ytEvents?.destroyed ?? []))
    .toContain("transition-first")
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__ytEvents?.createdDialogCounts?.find(
            (entry: { videoId: string }) => entry.videoId === "transition-second"
          )?.dialogCount ?? null
      )
    )
    .toBe(0)
  expect(pageErrors.join("\n")).not.toMatch(/removeChild|Application error/i)
  expect(consoleMessages.join("\n")).not.toMatch(/not attached to the DOM/i)
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
