import { expect, test, type Page, type Route } from "@playwright/test"

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

async function mockSpotifyDevices(page: Page, status = 200) {
  await page.route("https://api.spotify.com/v1/me/player/devices", async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ devices: [] }),
    })
  })
}

async function mockSpotifySdk(page: Page) {
  await page.route("https://sdk.scdn.co/spotify-player.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (() => {
          class MockPlayer {
            constructor(config) {
              this.config = config;
              this.listeners = {};
            }
            addListener(event, callback) {
              this.listeners[event] = callback;
            }
            connect() {
              setTimeout(() => {
                if (this.listeners.ready) {
                  this.listeners.ready({ device_id: "test-device-id" });
                }
              }, 0);
              return Promise.resolve(true);
            }
            disconnect() {
              return undefined;
            }
            pause() {
              return Promise.resolve();
            }
            resume() {
              return Promise.resolve();
            }
            getCurrentState() {
              return Promise.resolve({});
            }
          }

          window.Spotify = { Player: MockPlayer };
          setTimeout(() => {
            if (window.onSpotifyWebPlaybackSDKReady) {
              window.onSpotifyWebPlaybackSDKReady();
            }
          }, 0);
        })();
      `,
    })
  })
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

async function mockPremiumPlayback(page: Page) {
  await page.route(/https:\/\/api\.spotify\.com\/v1\/me\/player$/, async (route: Route) => {
    const method = route.request().method()

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ device: { id: "test-device-id" } }),
      })
      return
    }

    await route.fulfill({
      status: 204,
      body: "",
    })
  })

  await page.route(/https:\/\/api\.spotify\.com\/v1\/me\/player\/play\?device_id=.*/, async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    })
  })
}

test("shows a configuration error when Spotify config is missing", async ({ page }) => {
  await page.route("**/api/spotify/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clientId: "",
        redirectUri: "http://127.0.0.1:3100/callback",
        scopes: "streaming",
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Connect Spotify Premium" }).click()

  await expect(page.getByText("Configuration Error")).toBeVisible()
  await expect(page.getByText("SPOTIFY_CLIENT_ID environment variable is not set")).toBeVisible()
})

test("redirects to Spotify authorize with the callback page redirect URI", async ({ page }) => {
  await page.route("**/api/spotify/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clientId: "test-client-id",
        redirectUri: "http://127.0.0.1:3100/callback",
        scopes: "streaming user-read-email",
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Connect Spotify Premium" }).click()

  await page.waitForURL(/https:\/\/accounts\.spotify\.com\//)
  const redirectUrl = decodeURIComponent(page.url())
  expect(redirectUrl).toContain("redirect_uri=http%3A%2F%2F127.0.0.1%3A3100%2Fcallback")
})

test("stores tokens and lands on playlist after a successful callback exchange", async ({ page }) => {
  await mockSpotifyDevices(page)

  await page.route("**/api/spotify/callback", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      }),
    })
  })

  await page.goto("/callback?code=test-code")

  await page.waitForURL("**/playlist")
  await expect(page.getByText("Connect Playlist")).toBeVisible()

  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("spotify_access_token"))).toBe("new-access-token")
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("spotify_refresh_token"))).toBe("new-refresh-token")
})

test("allows unauthenticated users to access the playlist page as guest", async ({ page }) => {
  await page.goto("/playlist")

  await expect(page.getByText("Connect Playlist")).toBeVisible()
})

test("loads playlist tracks and enables the start-game state", async ({ page }) => {
  await seedStorage(page, {
    spotify_access_token: "playlist-token",
    spotify_refresh_token: "playlist-refresh",
    spotify_expires_at: "9999999999999",
  })

  await mockSpotifyDevices(page)

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

test("loads YouTube playlist tracks and enables the start-game state", async ({ page }) => {
  await seedStorage(page, {
    spotify_access_token: "playlist-token",
    spotify_refresh_token: "playlist-refresh",
    spotify_expires_at: "9999999999999",
  })

  await mockSpotifyDevices(page)

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
  await page.getByRole("button", { name: "Play Guest (YouTube Playlist)" }).click()
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

test("plays Spotify preview tracks through HTML audio", async ({ page }) => {
  await mockHtmlAudio(page)
  await seedStorage(page, {
    spotify_access_token: "game-token",
    spotify_refresh_token: "game-refresh",
    spotify_expires_at: "9999999999999",
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
    spotify_access_token: "game-token",
    spotify_refresh_token: "game-refresh",
    spotify_expires_at: "9999999999999",
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

  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.play)).toBe(1)
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.seek.length)).toBeGreaterThan(0)
})

test("shows an audio error when YouTube fallback search fails", async ({ page }) => {
  await seedStorage(page, {
    spotify_access_token: "game-token",
    spotify_refresh_token: "game-refresh",
    spotify_expires_at: "9999999999999",
    game_tracks: JSON.stringify(mockSpotifyNoPreviewTracks),
  })

  await page.route("**/api/youtube/search?q=*", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "No YouTube video was found." }),
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
    spotify_access_token: "game-token",
    spotify_refresh_token: "game-refresh",
    spotify_expires_at: "9999999999999",
    game_tracks: JSON.stringify(mockSpotifyNoPreviewTracks),
  })

  await page.route("**/api/youtube/search?q=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ videoId: "6uVJqD2hSGQ" }),
    })
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await page.getByLabel("Play preview").click()

  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.play)).toBe(1)
  await expect.poll(async () => page.evaluate(() => (window as any).__ytEvents.cue)).toContain("6uVJqD2hSGQ")
})

test("shows a Spotify connection error when a guest loads a Spotify playlist", async ({ page }) => {
  await page.goto("/playlist")

  await page.getByPlaceholder("https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=...").fill("https://open.spotify.com/playlist/playlist123")
  await page.getByRole("button", { name: "Load Playlist" }).click()

  await expect(page.getByText("Connect Spotify to load Spotify playlists.")).toBeVisible()
})

test("does not reveal local playlist suggestions in guest YouTube mode", async ({ page }) => {
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
  await expect(page.getByText("Other Song")).toBeVisible()
  await expect(page.locator("button", { hasText: "Em" })).toHaveCount(0)
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
          uri: "youtube:6uVJqD2hSGQ",
          videoId: "6uVJqD2hSGQ",
          name: "Em",
          artists: "Binz",
          albumImage: null,
        },
      ]),
    })
  })

  await page.goto("/game")
  await expect(page.getByText("Track 1 of 1")).toBeVisible()

  await page.getByPlaceholder("Know the song? Search artist or title...").fill("Binz")
  await page.getByRole("button", { name: /Em/ }).click()
  await page.getByRole("button", { name: "SUBMIT GUESS" }).click()

  await expect(page.getByText(/solved/i)).toBeVisible()
})

test("shows error when YouTube playlist fails to load", async ({ page }) => {
  await seedStorage(page, {
    spotify_access_token: "playlist-token",
    spotify_refresh_token: "playlist-refresh",
    spotify_expires_at: "9999999999999",
  })

  await mockSpotifyDevices(page)

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
  await seedStorage(page, {
    spotify_access_token: "game-token",
    spotify_refresh_token: "game-refresh",
    spotify_expires_at: "9999999999999",
  })

  await mockSpotifyDevices(page)
  await mockPremiumPlayback(page)

  await page.goto("/game")

  await page.waitForURL("**/playlist")
  await expect(page.getByText("Connect Playlist")).toBeVisible()
})

test("supports the main game controls with mocked Spotify playback", async ({ page }) => {
  await seedStorage(page, {
    spotify_access_token: "game-token",
    spotify_refresh_token: "game-refresh",
    spotify_expires_at: "9999999999999",
    game_tracks: JSON.stringify(mockTracks),
  })

  await mockSpotifySdk(page)
  await mockPremiumPlayback(page)

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

  await expect(page.getByText(/solved/i)).toBeVisible()
  await page.getByRole("button", { name: "NEXT SONG" }).click()

  await expect(page.getByText("Track 2 of 2")).toBeVisible()
})
