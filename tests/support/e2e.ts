import { expect, type Page } from "@playwright/test"

type TestSessionInput = {
  kind: "daily" | "lyrics" | "playlist" | "genre"
  playbackMode: "audio" | "lyrics"
  id: string
  runId?: string
  status?: "active" | "completed"
  startedAt?: string
  dateKey?: string
  genre?: "usuk" | "vpop" | "rap"
  playlistSource?: "spotify" | "youtube"
}

type TestSessionMeta = Required<Pick<TestSessionInput, "kind" | "playbackMode" | "id" | "runId" | "status" | "startedAt">> &
  Omit<TestSessionInput, "kind" | "playbackMode" | "id" | "runId" | "status" | "startedAt">

export async function seedStorage(page: Page, values: Record<string, unknown>) {
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(
        key,
        typeof value === "string" ? value : JSON.stringify(value)
      )
    }
  }, values)
}

export async function seedGame(
  page: Page,
  tracks: unknown[],
  input: TestSessionInput & { state?: Record<string, unknown> }
): Promise<TestSessionMeta> {
  const { state, ...sessionInput } = input
  const session = {
    ...sessionInput,
    runId: sessionInput.runId ?? `e2e-${sessionInput.id}`,
    status: sessionInput.status ?? "active",
    startedAt: sessionInput.startedAt ?? "2026-08-27T00:00:00.000Z",
  } as TestSessionMeta
  const stateKey = `songless_state_${session.runId}`
  await seedStorage(page, {
    game_tracks: tracks,
    full_playlist_tracks: tracks,
    songless_session_v2: session,
    ...(state ? { [stateKey]: state } : {}),
  })
  return session
}

export async function mockHtmlAudio(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).__audioEvents = { play: 0, pause: 0, lastSrc: "" }
    const originalPlay = window.HTMLMediaElement.prototype.play
    const originalPause = window.HTMLMediaElement.prototype.pause
    window.HTMLMediaElement.prototype.play = function () {
      ;(window as any).__audioEvents.play += 1
      ;(window as any).__audioEvents.lastSrc = this.currentSrc || this.getAttribute("src") || ""
      return Promise.resolve()
    }
    window.HTMLMediaElement.prototype.pause = function () {
      ;(window as any).__audioEvents.pause += 1
      return originalPause.call(this)
    }
    ;(window as any).__restoreAudioMocks = () => {
      window.HTMLMediaElement.prototype.play = originalPlay
      window.HTMLMediaElement.prototype.pause = originalPause
    }
  })
}

export async function mockYouTubeIframe(page: Page) {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (() => {
          window.__ytEvents = { cue: [], play: 0, pause: 0, seek: [] };
          class MockYouTubePlayer {
            constructor(id, config) {
              this.id = id;
              this.config = config;
              setTimeout(() => config.events?.onReady?.({ target: this }), 0);
            }
            cueVideoById(videoId) { window.__ytEvents.cue.push(videoId); }
            seekTo(seconds) { window.__ytEvents.seek.push(seconds); }
            playVideo() { window.__ytEvents.play += 1; this.config.events?.onStateChange?.({ target: this, data: 1 }); }
            pauseVideo() { window.__ytEvents.pause += 1; this.config.events?.onStateChange?.({ target: this, data: 2 }); }
            stopVideo() {}
            unMute() {}
            setVolume() {}
          }
          window.YT = { Player: MockYouTubePlayer };
          setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0);
        })();
      `,
    })
  })
}

export async function completeRun(page: Page, answers: string[]) {
  for (let index = 0; index < answers.length; index++) {
    const input = page.getByPlaceholder(/Know the song\?/)
    await input.fill(answers[index])
    await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
    await expect(page.getByRole("heading", { name: /SOLVED/i })).toBeVisible()
    await page
      .getByRole("button", {
        name: index === answers.length - 1 ? "VIEW SUMMARY" : "NEXT SONG",
      })
      .click()
  }
  await expect(page.getByText("Final Score")).toBeVisible()
}
