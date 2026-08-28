import { expect, test, type Locator, type Page } from "@playwright/test"

const mockTracks = [
  {
    source: "spotify",
    uri: "spotify:track:one",
    name: "First Song",
    artists: "Artist One",
    duration_ms: 180000,
    albumImage: null,
    preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    source: "spotify",
    uri: "spotify:track:two",
    name: "Second Song",
    artists: "Artist Two",
    duration_ms: 200000,
    albumImage: null,
    preview_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
]

const mockYoutubeTracks = [
  {
    source: "youtube",
    uri: "youtube:6uVJqD2hSGQ",
    videoId: "6uVJqD2hSGQ",
    name: "Em",
    artists: "Binz",
    duration_ms: 296000,
    albumImage: "https://i.ytimg.com/vi/6uVJqD2hSGQ/hqdefault.jpg",
    preview_url: null,
  },
]

const mockYoutubeTrackWithAudioStart = [
  {
    ...mockYoutubeTracks[0],
    audioStartSeconds: 17,
  },
]

const mockSpotifyNoPreviewTracks = [
  {
    source: "spotify",
    uri: "spotify:track:no-preview",
    name: "No Preview Song",
    artists: "Fallback Artist",
    duration_ms: 210000,
    albumImage: null,
    preview_url: null,
  },
]

const mockLyricsTrack = {
  source: "youtube",
  uri: "youtube:lyrics-test",
  videoId: "lyrics-test",
  name: "Hidden Answer",
  artists: "Secret Singer",
  duration_ms: 180000,
  albumImage: null,
  preview_url: null,
  genre: "vpop",
  challengeId: "lyrics-test",
  lyricsSnippets: [
    "Morning windows glow while quiet streets awaken",
    "Silver rivers carry every distant promise",
    "Paper lanterns drift beneath a violet skyline",
  ],
}

async function seedStorage(page: Page, values: Record<string, string>) {
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value)
    }
  }, values)
}

async function seedStorageOnce(page: Page, values: Record<string, string>) {
  await page.addInitScript((entries) => {
    if (window.sessionStorage.getItem("songless_e2e_seeded_once") === "1") return
    window.sessionStorage.setItem("songless_e2e_seeded_once", "1")
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value)
    }
  }, values)
}

async function mockClipboard(page: Page, shouldReject = false) {
  await page.addInitScript((rejectWrite) => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        async writeText(value: string) {
          if (rejectWrite) throw new Error("clipboard blocked")
          ;(window as any).__copiedShareText = value
        },
      },
    })
  }, shouldReject)
}

async function solveCurrentRun(page: Page, totalTracks: number) {
  for (let index = 0; index < totalTracks; index++) {
    const trackName = await page.evaluate((trackIndex) => {
      const tracks = JSON.parse(window.localStorage.getItem("game_tracks") || "[]")
      return tracks[trackIndex].name
    }, index)
    await page.getByPlaceholder(/Know the song\?/).fill(trackName)
    await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
    await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
    await page
      .getByRole("button", { name: index === totalTracks - 1 ? "VIEW SUMMARY" : "NEXT SONG" })
      .click()
  }
  await expect(page.getByText("Final Score")).toBeVisible()
}

async function mockHtmlAudio(page: Page) {
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

async function mockBrokenHtmlAudio(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).__audioEvents = { play: 0, pause: 0, lastSrc: "" }
    window.HTMLMediaElement.prototype.play = function () {
      ;(window as any).__audioEvents.play += 1
      ;(window as any).__audioEvents.lastSrc = this.currentSrc || this.getAttribute("src") || ""
      return Promise.reject(new Error("Mock audio failure"))
    }
  })
}

async function mockYouTubeIframe(page: Page) {
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
              setTimeout(() => {
                if (config.events && config.events.onReady) {
                  config.events.onReady({ target: this });
                }
              }, 0);
            }
            cueVideoById(videoId) { window.__ytEvents.cue.push(videoId); }
            seekTo(seconds) { window.__ytEvents.seek.push(seconds); }
            playVideo() { window.__ytEvents.play += 1; }
            pauseVideo() { window.__ytEvents.pause += 1; }
            stopVideo() {}
            unMute() {}
            setVolume() {}
          }
          window.YT = { Player: MockYouTubePlayer };
          setTimeout(() => {
            if (window.onYouTubeIframeAPIReady) {
              window.onYouTubeIframeAPIReady();
            }
          }, 0);
        })();
      `,
    })
  })
}

async function mockSeekSensitiveYouTubeIframe(page: Page) {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (() => {
          window.__ytEvents = { cue: [], play: 0, pause: 0, seek: [], audible: 0, ignoredPlay: 0 };
          class MockYouTubePlayer {
            constructor(id, config) {
              this.id = id;
              this.config = config;
              this.lastSeekAt = 0;
              this.isPlaying = false;
              setTimeout(() => {
                if (config.events && config.events.onReady) {
                  config.events.onReady({ target: this });
                }
              }, 0);
            }
            cueVideoById(videoId) { window.__ytEvents.cue.push(videoId); }
            seekTo(seconds) {
              window.__ytEvents.seek.push(seconds);
              this.lastSeekAt = Date.now();
              this.isPlaying = false;
            }
            playVideo() {
              window.__ytEvents.play += 1;
              if (Date.now() - this.lastSeekAt < 50) {
                window.__ytEvents.ignoredPlay += 1;
                return;
              }
              if (!this.isPlaying) {
                window.__ytEvents.audible += 1;
              }
              this.isPlaying = true;
            }
            pauseVideo() {
              window.__ytEvents.pause += 1;
              this.isPlaying = false;
            }
            stopVideo() { this.isPlaying = false; }
            unMute() {}
            setVolume() {}
          }
          window.YT = { Player: MockYouTubePlayer };
          setTimeout(() => {
            if (window.onYouTubeIframeAPIReady) {
              window.onYouTubeIframeAPIReady();
            }
          }, 0);
        })();
      `,
    })
  })
}

async function mockErroringYouTubeIframe(page: Page, errorsBeforeSuccess = 1) {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (() => {
          window.__ytEvents = { cue: [], play: 0, pause: 0, seek: [], errors: 0, destroys: 0 };
          class MockYouTubePlayer {
            constructor(id, config) {
              this.id = id;
              this.config = config;
              setTimeout(() => {
                if (config.events && config.events.onReady) {
                  config.events.onReady({ target: this });
                }
              }, 0);
            }
            cueVideoById(videoId) { window.__ytEvents.cue.push(videoId); }
            seekTo(seconds) { window.__ytEvents.seek.push(seconds); }
            playVideo() {
              window.__ytEvents.play += 1;
              if (window.__ytEvents.play <= ${errorsBeforeSuccess}) {
                window.__ytEvents.errors += 1;
                this.config.events?.onError?.({ target: this, data: 150 });
                return;
              }
              this.config.events?.onStateChange?.({ target: this, data: 1 });
            }
            pauseVideo() {
              window.__ytEvents.pause += 1;
              this.config.events?.onStateChange?.({ target: this, data: 2 });
            }
            stopVideo() {}
            destroy() { window.__ytEvents.destroys += 1; }
            unMute() {}
            setVolume() {}
          }
          window.YT = { Player: MockYouTubePlayer };
          setTimeout(() => {
            if (window.onYouTubeIframeAPIReady) {
              window.onYouTubeIframeAPIReady();
            }
          }, 0);
        })();
      `,
    })
  })
}

async function dispatchSynchronousClicks(locator: Locator) {
  await locator.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

test("allows unauthenticated users to access the playlist page as guest", async ({ page }) => {
  await page.goto("/playlist")

  await expect(page.getByText(/connect playlist/i)).toBeVisible()
})

test("loads playlist tracks and enables the start-game state", async ({ page }) => {
  await page.route("**/api/spotify/playlist?playlistId=playlist123", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockTracks),
    })
  })

  await page.goto("/playlist")

  await page.getByPlaceholder("https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=...").fill("playlist123")
  await page.getByRole("button", { name: "Load Playlist" }).click()

  await expect(page.getByText(/playlist loaded/i)).toBeVisible()
  await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("game_tracks"))).toContain("First Song")
})

test("shows playlist mode and lets the user return home", async ({ page }) => {
  await page.goto("/playlist")

  await expect(page.getByText("Mode: Guest Playlist Mode")).toBeVisible()
  await page.getByRole("button", { name: "Home" }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("button", { name: "Start Today's Challenge" })).toBeVisible()
})

test("loads YouTube playlist tracks and enables the start-game state", async ({ page }) => {
  await page.route("**/api/youtube/playlist?url=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "x-playlist-name": encodeURIComponent("My YouTube Playlist"),
      },
      body: JSON.stringify(mockYoutubeTracks),
    })
  })

  await page.goto("/playlist")

  await page.getByPlaceholder("https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=...").fill("https://www.youtube.com/playlist?list=PLpY7hx7jry7zc4zspi_fBhWQt8z5jrJ8z")
  await page.getByRole("button", { name: "Load Playlist" }).click()

  await expect(page.getByText(/playlist loaded/i)).toBeVisible()
  await expect(page.getByText("Found 1 valid tracks in this playlist")).toBeVisible()
  await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("game_tracks"))).toContain("youtube:6uVJqD2hSGQ")
})

test("lets a guest load a YouTube playlist and play the game", async ({ page }) => {
  await mockYouTubeIframe(page)

  await page.route("**/api/youtube/playlist?url=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "x-playlist-name": encodeURIComponent("Guest YouTube Playlist"),
      },
      body: JSON.stringify(mockYoutubeTracks),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Open Playlist Setup" }).click()
  await expect(page.getByText("Guest mode is active")).toBeVisible()

  await page.getByPlaceholder("https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=...").fill("https://www.youtube.com/playlist?list=PLpY7hx7jry7zc4zspi_fBhWQt8z5jrJ8z")
  await page.getByRole("button", { name: "Load Playlist" }).click()
  await expect(page.getByText(/playlist loaded/i)).toBeVisible()

  await page.getByRole("button", { name: "Start Game" }).click()
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await page.getByLabel("Play preview").click()
  await expect(page.getByLabel("Pause playback")).toBeEnabled()
  await page.getByRole("button", { name: /SKIP/ }).click()
  await expect(page.getByText("2 / 6")).toBeVisible()
})

test("starts the daily challenge as a three-track audio game", async ({ page }) => {
  await mockYouTubeIframe(page)

  await page.goto("/")
  await page.getByRole("button", { name: "Start Today's Challenge" }).click()

  await expect(page.getByText("Track 1 of 3")).toBeVisible()
  await expect(page.getByText("Mode: Daily Challenge")).toBeVisible()
  await expect(page.getByRole("button", { name: "Exit to Home" })).toBeVisible()
  await expect(page.getByLabel("Play preview")).toBeVisible()
  await expect.poll(async () => {
    return page.evaluate(() => {
      const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
      return session?.kind === "daily" &&
        session?.playbackMode === "audio" &&
        /^daily-audio-\d{4}-\d{2}-\d{2}$/.test(session?.id || "")
    })
  }).toBe(true)
  await expect.poll(async () => {
    return page.evaluate(() => {
      const tracks = JSON.parse(window.localStorage.getItem("game_tracks") || "[]")
      const genres = tracks.map((track: any) => track.genre).sort()
      return (
        tracks.length === 3 &&
        genres.join(",") === "rap,usuk,vpop" &&
        tracks.every(
          (track: any) =>
            track.audioAnalysisStatus === "approved" &&
            typeof track.audioStartSeconds === "number"
        )
      )
    })
  }).toBe(true)
})

test("keeps daily challenge progress in a daily-specific state key", async ({ page }) => {
  await mockYouTubeIframe(page)

  await page.goto("/")
  await page.getByRole("button", { name: "Start Today's Challenge" }).click()
  await expect(page.getByText("Track 1 of 3")).toBeVisible()

  await page.getByRole("button", { name: /SKIP/ }).click()

  await expect.poll(async () => {
    return page.evaluate(() => {
      const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
      return session?.runId ? window.localStorage.getItem(`songless_state_${session.runId}`) : null
    })
  }).toContain('"currentStage":1')
})

test("runs five genre tracks and persists local progression", async ({ page }) => {
  await mockYouTubeIframe(page)
  await page.goto("/")
  await page.getByRole("button", { name: "VPop" }).click()

  await expect(page.getByText("Track 1 of 5")).toBeVisible()
  const firstRun = await page.evaluate(() => {
    const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
    const tracks = JSON.parse(window.localStorage.getItem("game_tracks") || "[]")
    return {
      runId: session?.runId,
      kind: session?.kind,
      genre: session?.genre,
      uris: tracks.map((track: any) => track.uri),
      tracks,
    }
  })

  expect(firstRun.kind).toBe("genre")
  expect(firstRun.genre).toBe("vpop")
  expect(firstRun.uris).toHaveLength(5)
  expect(new Set(firstRun.uris).size).toBe(5)
  expect(firstRun.tracks.every((track: any) => track.genre === "vpop")).toBe(true)

  for (let index = 0; index < firstRun.tracks.length; index++) {
    await page.getByPlaceholder("Know the song? Search artist or title...").fill(firstRun.tracks[index].name)
    await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
    await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
    await page.getByRole("button", { name: index === 4 ? "VIEW SUMMARY" : "NEXT SONG" }).click()
  }

  await expect(page.getByText("Genre Practice Complete")).toBeVisible()
  await expect(page.getByText("Run Streak").locator("..").getByText("5")).toBeVisible()
  await expect(page.getByText("Best Score").locator("..").getByText("500")).toBeVisible()
  await expect.poll(async () => {
    return page.evaluate(() => {
      const store = JSON.parse(window.localStorage.getItem("songless_genre_progress_v1") || "{}")
      return store["audio:vpop"]
    })
  }).toEqual({
    bestStreak: 5,
    bestScore: 500,
    completedRuns: 1,
    totalSolved: 5,
  })

  await page.getByRole("button", { name: "REPLAY GENRE" }).click()
  await expect(page.getByText("Track 1 of 5")).toBeVisible()
  await expect.poll(async () => {
    return page.evaluate(() => {
      const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
      const tracks = JSON.parse(window.localStorage.getItem("game_tracks") || "[]")
      return {
        runId: session?.runId,
        uris: tracks.map((track: any) => track.uri),
      }
    })
  }).not.toEqual({ runId: firstRun.runId, uris: firstRun.uris })
})

test("plays partial lyrics mode without audio controls", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Quick Mix" }).click()

  await expect(page.getByText("Partial Lyrics Mode", { exact: true })).toBeVisible()
  await expect(page.getByText("Mode: Partial Lyrics Mode")).toBeVisible()
  await expect(page.getByRole("button", { name: "Exit to Home" })).toBeVisible()
  await expect(page.getByText("Track 1 of 5")).toBeVisible()
  await expect(page.getByLabel("Play preview")).toHaveCount(0)
  await expect.poll(async () => {
    return page.evaluate(() => {
      const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
      return session?.kind === "lyrics" && session?.playbackMode === "lyrics"
    })
  }).toBe(true)
})

test("reveals another lyrics clue after a wrong guess", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Quick Mix" }).click()
  await expect(page.getByText("Partial Lyrics Mode", { exact: true })).toBeVisible()

  await page.getByPlaceholder("Know the song? Search title...").fill("wrong song")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()

  await expect(page.getByText("Lyric clue 2 / 6")).toBeVisible()
})

test("accepts a correct partial lyrics guess", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Quick Mix" }).click()
  await expect(page.getByText("Partial Lyrics Mode", { exact: true })).toBeVisible()

  const currentTrackName = await page.evaluate(() => {
    const tracks = JSON.parse(window.localStorage.getItem("game_tracks") || "[]")
    return tracks[0].name
  })
  await page.getByPlaceholder("Know the song? Search title...").fill(currentTrackName)
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()

  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
})

test("keeps a lyrics clue on refresh and rotates it on replay", async ({ page }) => {
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockLyricsTrack]),
    songless_session_v2: JSON.stringify({
      kind: "lyrics",
      playbackMode: "lyrics",
      id: "lyrics-e2e",
      runId: "lyrics-run-1",
    }),
  })

  await page.goto("/game")
  const firstClue = await page.getByTestId("lyrics-clue").innerText()
  await page.reload()
  await expect(page.getByTestId("lyrics-clue")).toHaveText(firstClue)

  await page.getByPlaceholder("Know the song? Search title...").fill("Hidden Answer")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await page.getByRole("button", { name: "VIEW SUMMARY" }).click()
  await expect(page.getByText("Lyrics Complete")).toBeVisible()
  await page.getByRole("button", { name: "PLAY ANOTHER 5" }).click()

  await expect(page.getByTestId("lyrics-clue")).not.toHaveText(firstClue)
})

test("keeps a five-song lyrics run on refresh and changes its order on replay", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Quick Mix" }).click()
  await expect(page.getByText("Track 1 of 5")).toBeVisible()

  const firstRun = await page.evaluate(() => {
    const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
    const tracks = JSON.parse(window.localStorage.getItem("game_tracks") || "[]")
    return {
      runId: session.runId,
      order: tracks.map((track: any) => track.challengeId || track.uri),
      clue: document.querySelector('[data-testid="lyrics-clue"]')?.textContent,
    }
  })

  await page.reload()
  await expect(page.getByText("Track 1 of 5")).toBeVisible()
  await expect(page.getByTestId("lyrics-clue")).toHaveText(firstRun.clue || "")

  const finalTrackName = await page.evaluate(({ runId }) => {
    const tracks = JSON.parse(window.localStorage.getItem("game_tracks") || "[]")
    window.localStorage.setItem(
      `songless_state_${runId}`,
      JSON.stringify({
        currentIndex: 4,
        currentStage: 0,
        guesses: [],
        score: 0,
        correctCount: 0,
        solvedStageTotal: 0,
        currentStreak: 0,
        bestRunStreak: 0,
      })
    )
    return tracks[4].name
  }, firstRun)
  await page.reload()
  await expect(page.getByText("Track 5 of 5")).toBeVisible()
  await page.getByPlaceholder("Know the song? Search title...").fill(finalTrackName)
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await page.getByRole("button", { name: "VIEW SUMMARY" }).click()
  await page.getByRole("button", { name: "PLAY ANOTHER 5" }).click()

  await expect(page.getByText("Track 1 of 5")).toBeVisible()
  await expect.poll(async () => {
    return page.evaluate(() => {
      const tracks = JSON.parse(window.localStorage.getItem("game_tracks") || "[]")
      return tracks.map((track: any) => track.challengeId || track.uri)
    })
  }).not.toEqual(firstRun.order)
})

test("shows an actionable final lyrics clue inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockLyricsTrack]),
    songless_session_v2: JSON.stringify({
      kind: "lyrics",
      playbackMode: "lyrics",
      id: "lyrics-final-clue",
      runId: "lyrics-final-clue-run",
    }),
  })

  await page.goto("/game")
  for (let stage = 0; stage < 5; stage++) {
    await page.getByRole("button", { name: "REVEAL NEXT CLUE" }).click()
  }

  await expect(page.getByText("Final clue", { exact: true })).toBeVisible()
  await expect(page.getByTestId("final-clue-metadata")).toContainText("Secret Singer")
  await expect(page.getByTestId("final-clue-metadata")).toContainText("VPOP")
  await expect(page.getByTestId("lyrics-clue-panel")).toBeInViewport()
  await expect(page.getByPlaceholder("Know the song? Search title...")).toBeInViewport()
  await expect(page.getByRole("button", { name: "GIVE UP & REVEAL ANSWER" })).toBeInViewport()

  await page.getByRole("button", { name: "GIVE UP & REVEAL ANSWER" }).click()
  await expect(page.getByRole("heading", { name: /game over/i })).toBeVisible()
})

test("confirms discarding a started run and preserves it on cancel", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Quick Mix" }).click()
  await page.getByRole("button", { name: "REVEAL NEXT CLUE" }).click()

  await page.getByRole("button", { name: "Exit to Home" }).click()
  await expect(page.getByRole("alertdialog")).toContainText("Exit and discard this run?")
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByText("Track 1 of 5")).toBeVisible()

  await page.getByRole("button", { name: "Exit to Home" }).click()
  await page.getByRole("button", { name: "Exit and discard" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(async () =>
    page.evaluate(() => window.localStorage.getItem("songless_session_v2"))
  ).toBeNull()
})

test("continues an interrupted run and confirms before replacing it", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Quick Mix" }).click()
  await page.getByRole("button", { name: "REVEAL NEXT CLUE" }).click()
  const runId = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")?.runId
  })

  await page.goto("/")
  const banner = page.getByTestId("continue-run-banner")
  await expect(banner).toContainText("Track 1 of 5")
  await expect(banner).toContainText("Clue 2 of 6")

  await page.getByRole("button", { name: "Start Today's Challenge" }).click()
  await expect(page.getByRole("alertdialog")).toContainText(
    "Start a new run and discard current progress?"
  )
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(banner).toBeVisible()

  await page.getByRole("button", { name: "CONTINUE RUN" }).click()
  await expect(page.getByText("Track 1 of 5")).toBeVisible()
  await expect(page.getByText("Lyric clue 2 / 6")).toBeVisible()
  await expect.poll(async () =>
    page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")?.runId
    })
  ).toBe(runId)
})

test("records a completed daily once per UTC date and shows the seven-day history", async ({ page }) => {
  await mockYouTubeIframe(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Start Today's Challenge" }).click()
  await solveCurrentRun(page, 3)

  const firstProgress = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem("songless_daily_progress_v1") || "null")
  })
  expect(firstProgress.currentStreak).toBe(1)
  expect(firstProgress.history[0].completedRuns).toBe(1)

  await page.getByRole("button", { name: "REPLAY DAILY" }).click()
  await solveCurrentRun(page, 3)

  const replayProgress = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem("songless_daily_progress_v1") || "null")
  })
  expect(replayProgress.currentStreak).toBe(1)
  expect(replayProgress.history[0].completedRuns).toBe(2)

  await page.getByRole("button", { name: "HOME", exact: true }).last().click()
  await expect(page.getByTestId("daily-week")).toContainText("✓")
  await expect(page.getByRole("button", { name: "Play Again" })).toBeVisible()
})

test("shares a complete run without exposing the answer", async ({ page }) => {
  await mockClipboard(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockLyricsTrack]),
    songless_session_v2: JSON.stringify({
      kind: "lyrics",
      playbackMode: "lyrics",
      id: "lyrics-run-share",
      runId: "lyrics-run-share-id",
    }),
  })

  await page.goto("/game")
  await solveCurrentRun(page, 1)
  await page.getByRole("button", { name: "SHARE RUN" }).click()

  await expect(page.getByText("Run copied!")).toBeVisible()
  const shared = await page.evaluate(() => (window as any).__copiedShareText as string)
  expect(shared).toContain("1/1 solved")
  expect(shared).not.toContain("Hidden Answer")
  expect(shared).not.toContain("Secret Singer")
})

test("keeps run sharing retryable when clipboard access fails", async ({ page }) => {
  await mockClipboard(page, true)
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockLyricsTrack]),
    songless_session_v2: JSON.stringify({
      kind: "lyrics",
      playbackMode: "lyrics",
      id: "lyrics-run-share-error",
      runId: "lyrics-run-share-error-id",
    }),
  })

  await page.goto("/game")
  await solveCurrentRun(page, 1)
  await page.getByRole("button", { name: "SHARE RUN" }).click()

  await expect(page.getByText("Copy failed", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "SHARE RUN" })).toBeVisible()
})

test("uses one contextual HUD without playlist-only labels", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Quick Mix" }).click()

  const hud = page.getByTestId("game-hud")
  await expect(hud).toContainText("Track 1 of 5")
  await expect(hud).toContainText("Clue")
  await expect(page.getByText("Playlist Progress")).toHaveCount(0)
  await expect(page.getByText("Current Stage")).toHaveCount(0)
})

test("routes an untouched playlist run back to playlist setup without confirmation", async ({ page }) => {
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockTracks),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "playlist-navigation",
      runId: "playlist-navigation-run",
      playlistSource: "spotify",
    }),
  })

  await page.goto("/game")
  await page.getByRole("button", { name: "Back to Playlist Setup" }).click()
  await expect(page).toHaveURL(/\/playlist$/)
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
})

test("allows selecting clue text and shows pointer cursor on actions", async ({ page }) => {
  await page.goto("/")
  const startButton = page.getByRole("button", { name: "Start Lyrics Quick Mix" })
  await expect(startButton).toHaveCSS("cursor", "pointer")
  await startButton.click()

  const clue = page.getByTestId("lyrics-clue")
  await clue.scrollIntoViewIfNeeded()
  const box = await clue.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + 4, box!.y + 6)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width - 4, box!.y + box!.height - 6, { steps: 12 })
  await page.mouse.up()

  await expect.poll(async () =>
    page.evaluate(() => window.getSelection()?.toString().trim().length || 0)
  ).toBeGreaterThan(0)
  await expect(page.getByRole("button", { name: "REVEAL NEXT CLUE" })).toHaveCSS("cursor", "pointer")
})

test("keeps the homepage hierarchy responsive without horizontal overflow", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto("/")

    await expect(page.getByTestId("home-daily-card")).toBeVisible()
    const cards = page.getByTestId("home-mode-card")
    await expect(cards).toHaveCount(3)
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)

    const boxes = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width) }
      })
    )
    if (viewport.width >= 1024) {
      expect(new Set(boxes.map((box) => box.y)).size).toBe(1)
      expect(new Set(boxes.map((box) => box.x)).size).toBe(3)
    } else {
      expect(new Set(boxes.map((box) => box.x)).size).toBe(1)
      expect(boxes[0].y).toBeLessThan(boxes[1].y)
      expect(boxes[1].y).toBeLessThan(boxes[2].y)
    }
  }
})

test("reports share success only after clipboard resolves", async ({ page }) => {
  await mockClipboard(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockLyricsTrack]),
    songless_session_v2: JSON.stringify({
      kind: "lyrics",
      playbackMode: "lyrics",
      id: "lyrics-share-success",
      runId: "lyrics-share-success-run",
    }),
  })

  await page.goto("/game")
  await page.getByPlaceholder("Know the song? Search title...").fill("Hidden Answer")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await page.getByRole("button", { name: "SHARE RESULTS" }).click()

  await expect(page.getByText("Copied to clipboard!", { exact: true })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => (window as any).__copiedShareText)).toContain("http://127.0.0.1:3100")
})

test("reports share failure when clipboard rejects", async ({ page }) => {
  await mockClipboard(page, true)
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockLyricsTrack]),
    songless_session_v2: JSON.stringify({
      kind: "lyrics",
      playbackMode: "lyrics",
      id: "lyrics-share-failure",
      runId: "lyrics-share-failure-run",
    }),
  })

  await page.goto("/game")
  await page.getByPlaceholder("Know the song? Search title...").fill("Hidden Answer")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await page.getByRole("button", { name: "SHARE RESULTS" }).click()

  await expect(page.getByText("Copy failed", { exact: true })).toBeVisible()
  await expect(page.getByText("Copied to clipboard!")).toHaveCount(0)
})

test("plays Spotify preview tracks through HTML audio", async ({ page }) => {
  await mockHtmlAudio(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockTracks),
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 2")).toBeVisible()

  await page.getByLabel("Play preview").click()

  await expect.poll(async () => page.evaluate(() => (window as any).__audioEvents.play)).toBe(1)
  await expect.poll(async () => page.evaluate(() => (window as any).__audioEvents.lastSrc)).toContain("SoundHelix-Song-1.mp3")
})

test("shows an audio error when Spotify preview playback fails", async ({ page }) => {
  await mockBrokenHtmlAudio(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockTracks),
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 2")).toBeVisible()

  await page.getByLabel("Play preview").click()

  await expect(page.getByText("This audio preview could not be played.")).toBeVisible()
  await expect.poll(async () => page.evaluate(() => (window as any).__audioEvents.play)).toBe(1)
})

test("plays direct YouTube playlist tracks through the YouTube player", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockYoutubeTracks),
    current_playlist_id: "youtube-direct",
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await page.getByLabel("Play preview").click()

  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.play)).toBeGreaterThan(0)
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.seek.length)).toBeGreaterThan(0)
})

test("plays YouTube audio after repeated skips without alternating silence", async ({ page }) => {
  await mockSeekSensitiveYouTubeIframe(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockYoutubeTrackWithAudioStart),
    current_playlist_id: "youtube-repeat-start",
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await page.getByLabel("Play preview").click()
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.audible)).toBe(1)

  await page.getByRole("button", { name: /SKIP/ }).click()
  await page.getByLabel("Play preview").click()
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.audible)).toBe(2)

  await page.getByRole("button", { name: /SKIP/ }).click()
  await page.getByLabel("Play preview").click()
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.audible)).toBe(3)
})

test("starts YouTube playback from the configured audio start point", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockYoutubeTrackWithAudioStart),
    current_playlist_id: "youtube-start-offset",
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await page.getByLabel("Play preview").click()

  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.seek.at(-1))).toBe(17)
})

test("shows an audio error when YouTube fallback search fails", async ({ page }) => {
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockSpotifyNoPreviewTracks),
  })

  await page.route("**/api/youtube/search?title=*&artists=*", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "No verified YouTube audio source was found for this track." }),
    })
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await expect(page.getByText("No playable audio source was found for this track.")).toBeVisible()
  await expect(page.getByLabel("Play preview")).toBeDisabled()
})

test("falls back from Spotify no-preview tracks to YouTube playback", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockSpotifyNoPreviewTracks),
  })

  await page.route("**/api/youtube/search?title=*&artists=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        videoId: "6uVJqD2hSGQ",
        matchedTitle: "No Preview Song",
        matchedArtists: "Fallback Artist",
        matchScore: 140,
      }),
    })
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await page.getByLabel("Play preview").click()

  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.play)).toBeGreaterThan(0)
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.cue)).toContain("6uVJqD2hSGQ")
})

test("lets a guest load a public Spotify playlist", async ({ page }) => {
  await mockHtmlAudio(page)
  await page.route("**/api/spotify/playlist?playlistId=playlist123", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "x-playlist-name": encodeURIComponent("Public Spotify Playlist"),
      },
      body: JSON.stringify(mockTracks),
    })
  })

  await page.goto("/playlist")

  await page.getByPlaceholder("https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=...").fill("https://open.spotify.com/playlist/playlist123")
  await page.getByRole("button", { name: "Load Playlist" }).click()

  await expect(page.getByText(/playlist loaded/i)).toBeVisible()
  await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("game_tracks"))).toContain("First Song")

  await page.getByRole("button", { name: "Start Game" }).click()
  await expect(page.getByText("Track 1 of 2")).toBeVisible()
  await page.getByLabel("Play preview").click()
  await expect.poll(async () => page.evaluate(() => (window as any).__audioEvents.play)).toBe(1)
})

test("prioritizes current playlist suggestions in guest YouTube mode", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockYoutubeTracks),
    current_playlist_id: "youtube-test",
  })
  await page.route("**/api/youtube/suggestions?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          uri: "youtube:notCurrent",
          videoId: "notCurrent",
          name: "Other Song",
          artists: "Other Artist",
          albumImage: null,
        },
      ]),
    })
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await page.getByPlaceholder("Know the song? Search artist or title...").fill("Binz")
  await expect(page.locator("button", { hasText: "Em" })).toBeVisible()
  await expect(page.getByText("Other Song")).toBeVisible()
})

test("accepts a selected YouTube search suggestion in guest mode", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockYoutubeTracks),
    current_playlist_id: "youtube-test",
  })
  await page.route("**/api/youtube/suggestions?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          uri: "youtube:different",
          videoId: "different",
          name: "Em (Official Music Video)",
          artists: "Binz",
          albumImage: null,
        },
      ]),
    })
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await page.getByPlaceholder("Know the song? Search artist or title...").fill("Binz")
  await page.getByRole("button", { name: "Em Binz" }).click()
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()

  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
})

test("shows error when YouTube playlist fails to load", async ({ page }) => {
  await page.route("**/api/youtube/playlist?url=*", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "YouTube API returned error: Playlist does not exist" }),
    })
  })

  await page.goto("/playlist")

  await page.getByPlaceholder("https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=...").fill("https://www.youtube.com/playlist?list=invalid_id")
  await page.getByRole("button", { name: "Load Playlist" }).click()

  await expect(page.getByText("YouTube API returned error: Playlist does not exist")).toBeVisible()
})

test("redirects the game page back to playlist when no tracks are loaded", async ({ page }) => {
  await page.goto("/game")

  await page.waitForURL("**/playlist")
  await expect(page.getByText(/connect playlist/i)).toBeVisible()
})

test("supports the main game controls with mocked audio playback", async ({ page }) => {
  await mockHtmlAudio(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockTracks),
  })

  await page.goto("/game")

  await expect(page.getByText("Track 1 of 2")).toBeVisible()
  await expect(page.getByText("1 / 6")).toBeVisible()

  await page.getByLabel("Play preview").click()
  await expect(page.getByLabel("Pause playback")).toBeEnabled()

  await page.getByLabel("Pause playback").click()
  await expect(page.getByLabel("Play preview")).toBeEnabled()

  await page.getByRole("button", { name: /SKIP/ }).click()
  await expect(page.getByText("2 / 6")).toBeVisible()

  await page.getByPlaceholder("Know the song? Search artist or title...").fill("First Song")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()

  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
  await expect(page.getByText("+80")).toBeVisible()
  await page.getByRole("button", { name: "NEXT SONG" }).click()
  await page.waitForTimeout(100)
  await expect(page.getByText("Second Song")).toHaveCount(0)

  await expect(page.getByText("Track 2 of 2")).toBeVisible()
  await expect(page.getByText(/^80$/)).toBeVisible()

  await page.getByPlaceholder("Know the song? Search artist or title...").fill("Second Song")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()

  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
  await expect(page.getByText("+100")).toBeVisible()
  await page.getByRole("button", { name: "VIEW SUMMARY" }).click()

  await expect(page.getByText("Final Score")).toBeVisible()
  await expect(page.getByText("180")).toBeVisible()
  await expect(page.getByText("2 / 2")).toBeVisible()
  await expect(page.getByRole("button", { name: "REPLAY PLAYLIST" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "BACK TO PLAYLIST SETUP", exact: true }).last()
  ).toBeVisible()
})

test("does not duplicate a synchronous double submit", async ({ page }) => {
  await mockHtmlAudio(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockTracks[0]]),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "guess-lock",
      runId: "guess-lock-run",
    }),
  })

  await page.goto("/game")
  const input = page.getByPlaceholder("Know the song? Search artist or title...")
  await input.fill("First Song")
  await dispatchSynchronousClicks(page.getByRole("button", { name: "SUBMIT GUESS" }))

  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
    return JSON.parse(window.localStorage.getItem(`songless_state_${session?.runId}`) || "null")
  })).toMatchObject({ score: 100, correctCount: 1, trackResults: [{ trackId: "spotify:track:one" }] })
})

test("does not duplicate a synchronous double skip at the final clue", async ({ page }) => {
  await mockHtmlAudio(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockTracks[0]]),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "skip-lock",
      runId: "skip-lock-run",
    }),
  })

  await page.goto("/game")
  const skip = page.getByRole("button", { name: /SKIP/ })
  for (let stage = 1; stage < 6; stage++) {
    await skip.click()
    await expect(page.getByText(`${stage + 1} / 6`)).toBeVisible()
  }
  await dispatchSynchronousClicks(skip)

  await expect(page.getByRole("heading", { name: /game over/i })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
    return JSON.parse(window.localStorage.getItem(`songless_state_${session?.runId}`) || "null")
  })).toMatchObject({ score: 0, correctCount: 0, trackResults: [{ trackId: "spotify:track:one", status: "failed" }] })
})

test("advances only once after a synchronous double next-song click", async ({ page }) => {
  await mockHtmlAudio(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockTracks),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "next-lock",
      runId: "next-lock-run",
    }),
  })

  await page.goto("/game")
  await page.getByPlaceholder("Know the song? Search artist or title...").fill("First Song")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
  await dispatchSynchronousClicks(page.getByRole("button", { name: "NEXT SONG" }))

  await expect(page.getByText("Track 2 of 2")).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
    return JSON.parse(window.localStorage.getItem(`songless_state_${session?.runId}`) || "null")
  })).toMatchObject({ currentIndex: 1, trackResults: [{ trackId: "spotify:track:one" }] })
})

test("keeps a resolved result modal open and finalizes a daily run once", async ({ page }) => {
  await mockHtmlAudio(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockTracks[0]]),
    songless_session_v2: JSON.stringify({
      kind: "daily",
      playbackMode: "audio",
      id: "daily-audio-2026-08-01",
      runId: "daily-lock-run",
      dateKey: "2026-08-01",
    }),
  })

  await page.goto("/game")
  await page.getByPlaceholder("Know the song? Search artist or title...").fill("First Song")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()

  await dispatchSynchronousClicks(page.getByRole("button", { name: "VIEW SUMMARY" }))
  await expect(page.getByText("Final Score")).toBeVisible()
  await expect.poll(async () => page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem("songless_daily_progress_v1") || "null")
      ?.history?.[0]?.completedRuns
  })).toBe(1)
})

test("restores the completed summary after a direct game refresh", async ({ page }) => {
  await mockHtmlAudio(page)
  await seedStorageOnce(page, {
    game_tracks: JSON.stringify([mockTracks[0]]),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "refresh-complete",
      runId: "refresh-complete-run",
    }),
  })

  await page.goto("/game")
  await page.getByPlaceholder("Know the song? Search artist or title...").fill("First Song")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
  await page.getByRole("button", { name: "VIEW SUMMARY" }).click()
  await expect(page.getByText("Final Score")).toBeVisible()

  await expect.poll(async () => page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")?.status
  })).toBe("completed")
  await page.reload()

  await expect(page.getByText("Final Score")).toBeVisible()
  await expect(page.getByText("1 / 1")).toBeVisible()
})

test("does not show a continue banner for a completed session", async ({ page }) => {
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockTracks[0]]),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "completed-home",
      runId: "completed-home-run",
      status: "completed",
    }),
    songless_state_completed_home_run: JSON.stringify({
      currentIndex: 0,
      currentStage: 0,
      guesses: [],
      score: 100,
      correctCount: 1,
      solvedStageTotal: 1,
      currentStreak: 1,
      bestRunStreak: 1,
      trackResults: [{
        trackId: "spotify:track:one",
        status: "solved",
        attempts: ["correct"],
        completedStage: 0,
        points: 100,
      }],
    }),
  })

  await page.goto("/")
  await expect(page.getByTestId("continue-run-banner")).toHaveCount(0)
})

test("replaces a stale YouTube cache entry and retries once", async ({ page }) => {
  await mockErroringYouTubeIframe(page, 1)
  let searchCalls = 0
  await page.route("**/api/youtube/search?title=*&artists=*", async (route) => {
    searchCalls += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        videoId: "replacement123",
        matchedTitle: "No Preview Song",
        matchedArtists: "Fallback Artist",
        matchScore: 140,
      }),
    })
  })
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockSpotifyNoPreviewTracks),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "stale-cache",
      runId: "stale-cache-run",
    }),
    "songless_yt_cache_spotify%3Atrack%3Ano-preview": "stale123",
  })

  await page.goto("/game")
  await page.getByLabel("Play preview").click()
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.play)).toBeGreaterThan(0)
  await expect.poll(async () => searchCalls).toBe(1)
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.cue)).toContain("replacement123")
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("songless_yt_cache_spotify%3Atrack%3Ano-preview"))).toBe("replacement123")

  await page.getByLabel("Play preview").click()
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.errors)).toBe(1)
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.play)).toBeGreaterThan(1)
})

test("keeps Skip available after YouTube retry failure without looping", async ({ page }) => {
  await mockErroringYouTubeIframe(page, 2)
  let searchCalls = 0
  await page.route("**/api/youtube/search?title=*&artists=*", async (route) => {
    searchCalls += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ videoId: "replacement123" }),
    })
  })
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockSpotifyNoPreviewTracks),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "retry-failure",
      runId: "retry-failure-run",
    }),
    "songless_yt_cache_spotify%3Atrack%3Ano-preview": "stale123",
  })

  await page.goto("/game")
  await page.getByLabel("Play preview").click()
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.cue)).toContain("replacement123")
  await page.getByLabel("Play preview").click()

  await expect(page.getByText("This YouTube audio source could not be played.")).toBeVisible()
  await expect.poll(async () => searchCalls).toBe(1)
  await expect(page.getByRole("button", { name: /SKIP/ })).toBeEnabled()
})

test("does not fallback-search a direct YouTube error", async ({ page }) => {
  await mockErroringYouTubeIframe(page, 1)
  let searchCalls = 0
  await page.route("**/api/youtube/search?title=*&artists=*", async (route) => {
    searchCalls += 1
    await route.continue()
  })
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockYoutubeTracks),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "direct-error",
      runId: "direct-error-run",
    }),
  })

  await page.goto("/game")
  await page.getByLabel("Play preview").click()
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.play)).toBeGreaterThan(0)
  await expect(page.getByText("This YouTube audio source could not be played.")).toBeVisible()
  expect(searchCalls).toBe(0)
  await expect(page.getByRole("button", { name: /SKIP/ })).toBeEnabled()
})

test("keeps only the newest suggestion response", async ({ page }) => {
  await mockYouTubeIframe(page)
  let releaseOld!: () => void
  let oldRequestSeen = false
  const oldResponse = new Promise<void>((resolve) => {
    releaseOld = resolve
  })
  await page.route("**/api/youtube/suggestions?q=*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")
    if (query === "old") {
      oldRequestSeen = true
      await oldResponse
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ uri: "youtube:old", videoId: "old", name: "Old Song", artists: "Old Artist", albumImage: null }]),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ uri: "youtube:new", videoId: "new", name: "New Song", artists: "New Artist", albumImage: null }]),
    })
  })
  await seedStorage(page, {
    game_tracks: JSON.stringify(mockYoutubeTracks),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "suggestion-race",
      runId: "suggestion-race-run",
    }),
  })

  await page.goto("/game")
  const input = page.getByPlaceholder("Know the song? Search artist or title...")
  await input.fill("old")
  await expect.poll(async () => oldRequestSeen).toBe(true)
  await input.fill("new")
  await expect(page.getByText("New Song")).toBeVisible()
  releaseOld()
  await page.waitForTimeout(100)
  await expect(page.getByText("Old Song")).toHaveCount(0)
})

test("keeps Playlist All unlimited beyond fifty tracks", async ({ page }) => {
  await mockHtmlAudio(page)
  const manyTracks = Array.from({ length: 51 }, (_, index) => ({
    ...mockTracks[0],
    uri: `spotify:track:many-${index}`,
    name: `Many Song ${index + 1}`,
  }))
  await page.route("**/api/spotify/playlist?playlistId=playlist123", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manyTracks) })
  })

  await page.goto("/playlist")
  await page.getByPlaceholder("https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=...").fill("playlist123")
  await page.getByRole("button", { name: "Load Playlist" }).click()
  await expect(page.getByText("Found 51 valid tracks in this playlist")).toBeVisible()
  await page.getByRole("button", { name: "All", exact: true }).click()
  await page.getByRole("button", { name: "START GAME" }).click()

  await expect(page.getByText("Track 1 of 51")).toBeVisible()
  await expect.poll(async () => page.evaluate(() => JSON.parse(window.localStorage.getItem("game_tracks") || "[]").length)).toBe(51)
})

test("keeps the audio game usable on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockHtmlAudio(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockTracks[0]]),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "mobile-game",
      runId: "mobile-game-run",
    }),
  })

  await page.goto("/game")
  await expect(page.getByTestId("guess-action-panel")).toBeVisible()
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByPlaceholder("Know the song? Search artist or title...").fill("First Song")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()

  const nextButton = page.getByRole("button", { name: "VIEW SUMMARY" })
  await nextButton.scrollIntoViewIfNeeded()
  const box = await nextButton.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await nextButton.click()
  await expect(page.getByText("Final Score")).toBeVisible()
})

test("keeps Skip enabled on mobile when preview playback fails", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockBrokenHtmlAudio(page)
  await seedStorage(page, {
    game_tracks: JSON.stringify([mockTracks[0]]),
    songless_session_v2: JSON.stringify({
      kind: "playlist",
      playbackMode: "audio",
      id: "mobile-audio-error",
      runId: "mobile-audio-error-run",
    }),
  })

  await page.goto("/game")
  await page.getByLabel("Play preview").click()
  await expect(page.getByText("This audio preview could not be played.")).toBeVisible()
  await expect(page.getByRole("button", { name: /SKIP/ })).toBeEnabled()
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
