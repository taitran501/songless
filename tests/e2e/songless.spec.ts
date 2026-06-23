import { expect, test, type Page, type Route } from "@playwright/test"

const mockTracks = [
  {
    uri: "spotify:track:one",
    name: "First Song",
    duration_ms: 180000,
    albumImage: null,
  },
  {
    uri: "spotify:track:two",
    name: "Second Song",
    duration_ms: 200000,
    albumImage: null,
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
  await expect(page.getByText("Add Playlist")).toBeVisible()

  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("spotify_access_token"))).toBe("new-access-token")
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("spotify_refresh_token"))).toBe("new-refresh-token")
})

test("redirects unauthenticated users away from the playlist page", async ({ page }) => {
  await page.goto("/playlist")

  await page.waitForURL("**/")
  await expect(page.getByText("SonglessUnlimited")).toBeVisible()
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

  await page.getByPlaceholder("Enter Spotify playlist ID or URL").fill("playlist123")
  await page.getByRole("button", { name: "Load Playlist" }).click()

  await expect(page.getByText("Playlist Loaded Successfully!")).toBeVisible()
  await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible()
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("game_tracks"))).toContain("First Song")
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
  await expect(page.getByText("Add Playlist")).toBeVisible()
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
  await expect(page.getByText("Stage 1 of 6")).toBeVisible()

  await page.getByLabel("Play preview").click()
  await expect(page.getByLabel("Pause playback")).toBeEnabled()

  await page.getByLabel("Pause playback").click()
  await expect(page.getByLabel("Resume playback")).toBeEnabled()

  await page.getByRole("button", { name: /SKIP TO NEXT/ }).click()
  await expect(page.getByText("Stage 2 of 6")).toBeVisible()

  await page.getByPlaceholder("Know it? Search for the title").fill("First Song")
  await page.getByRole("button", { name: "SUBMIT" }).click()

  await expect(page.getByText("Correct!")).toBeVisible()
  await page.getByRole("button", { name: "NEXT SONG" }).click()

  await expect(page.getByText("Track 2 of 2")).toBeVisible()
})
