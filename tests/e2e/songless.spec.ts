import { expect, test, type Page } from "@playwright/test"

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

async function seedStorage(page: Page, values: Record<string, string>) {
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value)
    }
  }, values)
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
  await expect(page.getByRole("button", { name: "Start Daily Challenge" })).toBeVisible()
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
  await page.getByRole("button", { name: "Play as Guest" }).click()
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
  await page.getByRole("button", { name: "Start Daily Challenge" }).click()

  await expect(page.getByText("Track 1 of 3")).toBeVisible()
  await expect(page.getByText("Mode: Daily Challenge")).toBeVisible()
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible()
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
  await page.getByRole("button", { name: "Start Daily Challenge" }).click()
  await expect(page.getByText("Track 1 of 3")).toBeVisible()

  await page.getByRole("button", { name: /SKIP/ }).click()

  await expect.poll(async () => {
    return page.evaluate(() => {
      const session = JSON.parse(window.localStorage.getItem("songless_session_v2") || "null")
      return session?.runId ? window.localStorage.getItem(`songless_state_${session.runId}`) : null
    })
  }).toContain('"currentStage":1')
})

test("plays partial lyrics mode without audio controls", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Mode" }).click()

  await expect(page.getByText("Partial Lyrics Mode")).toBeVisible()
  await expect(page.getByText("Mode: Partial Lyrics Mode")).toBeVisible()
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible()
  await expect(page.getByText("Track 1 of")).toBeVisible()
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
  await page.getByRole("button", { name: "Start Lyrics Mode" }).click()
  await expect(page.getByText("Partial Lyrics Mode")).toBeVisible()

  await page.getByPlaceholder("Know the song? Search title...").fill("wrong song")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()

  await expect(page.getByText("Lyric clue 2 / 6")).toBeVisible()
})

test("accepts a correct partial lyrics guess", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Mode" }).click()
  await expect(page.getByText("Partial Lyrics Mode")).toBeVisible()

  await page.getByPlaceholder("Know the song? Search title...").fill("Hay Trao Cho Anh")
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()

  await expect(page.getByRole("heading", { name: /solved/i })).toBeVisible()
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
  await expect(page.getByRole("button", { name: "LOAD ANOTHER" })).toBeVisible()
})
