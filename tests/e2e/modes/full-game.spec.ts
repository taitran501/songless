import { expect, test, type Page } from "@playwright/test"

type TestTrack = {
  source: "spotify" | "youtube"
  uri: string
  videoId?: string
  name: string
  artists: string
  duration_ms: number
  albumImage: string | null
  preview_url: string | null
  genre?: "vpop" | "usuk" | "rap"
  challengeId?: string
  lyricsSnippets?: string[]
  audioStartSeconds?: number
  audioAnalysisStatus?: "approved" | "failed"
}

function track(overrides: Partial<TestTrack> & Pick<TestTrack, "uri" | "name" | "artists">): TestTrack {
  const source = overrides.source ?? (overrides.uri.startsWith("youtube:") ? "youtube" : "spotify")
  return {
    source,
    uri: overrides.uri,
    name: overrides.name,
    artists: overrides.artists,
    duration_ms: overrides.duration_ms ?? 180_000,
    albumImage: null,
    preview_url: overrides.preview_url ?? (source === "spotify" ? "https://example.test/preview.mp3" : null),
    ...(source === "youtube" ? { videoId: overrides.videoId ?? overrides.uri.slice("youtube:".length) } : {}),
    ...(overrides.genre ? { genre: overrides.genre } : {}),
    ...(overrides.challengeId ? { challengeId: overrides.challengeId } : {}),
    ...(overrides.lyricsSnippets ? { lyricsSnippets: overrides.lyricsSnippets } : {}),
    ...(overrides.audioStartSeconds !== undefined ? { audioStartSeconds: overrides.audioStartSeconds } : {}),
    ...(overrides.audioAnalysisStatus ? { audioAnalysisStatus: overrides.audioAnalysisStatus } : {}),
  }
}

const dailyTracks = [
  track({ source: "youtube", uri: "youtube:daily-vpop", name: "Daily VPop", artists: "VPop Artist", genre: "vpop", challengeId: "daily-vpop", audioStartSeconds: 12, audioAnalysisStatus: "approved" }),
  track({ source: "youtube", uri: "youtube:daily-usuk", name: "Daily USUK", artists: "USUK Artist", genre: "usuk", challengeId: "daily-usuk", audioStartSeconds: 9, audioAnalysisStatus: "approved" }),
  track({ source: "youtube", uri: "youtube:daily-rap", name: "Daily Rap", artists: "Rap Artist", genre: "rap", challengeId: "daily-rap", audioStartSeconds: 15, audioAnalysisStatus: "approved" }),
]

const lyricsTracks = [
  track({ source: "youtube", uri: "youtube:lyrics-vpop-1", name: "Lyrics VPop 1", artists: "VPop Artist", genre: "vpop", challengeId: "lyrics-vpop-1", lyricsSnippets: ["quiet morning beside the river and distant clouds", "silver river beneath the wide open sky tonight", "violet skyline after the rain across the city"] }),
  track({ source: "youtube", uri: "youtube:lyrics-vpop-2", name: "Lyrics VPop 2", artists: "VPop Artist", genre: "vpop", challengeId: "lyrics-vpop-2", lyricsSnippets: ["quiet morning beside the river and distant clouds", "silver river beneath the wide open sky tonight", "violet skyline after the rain across the city"] }),
  track({ source: "youtube", uri: "youtube:lyrics-usuk-1", name: "Lyrics USUK 1", artists: "USUK Artist", genre: "usuk", challengeId: "lyrics-usuk-1", lyricsSnippets: ["quiet morning beside the river and distant clouds", "silver river beneath the wide open sky tonight", "violet skyline after the rain across the city"] }),
  track({ source: "youtube", uri: "youtube:lyrics-usuk-2", name: "Lyrics USUK 2", artists: "USUK Artist", genre: "usuk", challengeId: "lyrics-usuk-2", lyricsSnippets: ["quiet morning beside the river and distant clouds", "silver river beneath the wide open sky tonight", "violet skyline after the rain across the city"] }),
  track({ source: "youtube", uri: "youtube:lyrics-rap-1", name: "Lyrics Rap 1", artists: "Rap Artist", genre: "rap", challengeId: "lyrics-rap-1", lyricsSnippets: ["quiet morning beside the river and distant clouds", "silver river beneath the wide open sky tonight", "violet skyline after the rain across the city"] }),
]

const genreTracks = Array.from({ length: 5 }, (_, index) =>
  track({
    source: "spotify",
    uri: `spotify:genre-vpop-${index + 1}`,
    name: `Genre VPop ${index + 1}`,
    artists: `VPop Artist ${index + 1}`,
    genre: "vpop",
  })
)

const playlistTracks = [
  track({ source: "spotify", uri: "spotify:playlist-one", name: "Playlist One", artists: "Playlist Artist" }),
  track({ source: "youtube", uri: "youtube:playlist-two", name: "Playlist Two", artists: "Playlist Artist" }),
]

async function seedGame(page: Page, tracks: TestTrack[], session: Record<string, unknown>) {
  await page.addInitScript(({ nextTracks, nextSession }) => {
    window.localStorage.setItem("game_tracks", JSON.stringify(nextTracks))
    window.localStorage.setItem("full_playlist_tracks", JSON.stringify(nextTracks))
    window.localStorage.setItem("songless_session_v2", JSON.stringify(nextSession))
  }, { nextTracks: tracks, nextSession: { status: "active", startedAt: "2026-08-27T00:00:00.000Z", ...session } })
}

async function completeRun(page: Page, answers: string[]) {
  for (let index = 0; index < answers.length; index++) {
    await page.getByPlaceholder(/Know the song\?/).fill(answers[index])
    await page.getByRole("button", { name: "SUBMIT GUESS" }).click()
    await expect(page.getByRole("heading", { name: /SOLVED/i })).toBeVisible()
    await page.getByRole("button", { name: index === answers.length - 1 ? "VIEW SUMMARY" : "NEXT SONG" }).click()
  }
  await expect(page.getByText("Final Score")).toBeVisible()
}

async function mockYouTubeIframe(page: Page) {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `(() => { window.__ytEvents = { cue: [], play: 0, pause: [], seek: [] }; class Player { constructor(id, config) { this.config = config; setTimeout(() => config.events?.onReady?.({ target: this }), 0); } cueVideoById() {} seekTo() {} playVideo() {} pauseVideo() {} stopVideo() {} unMute() {} setVolume() {} } window.YT = { Player }; setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0); })();`,
    })
  })
}

test("@smoke @daily completes the daily audio run", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedGame(page, dailyTracks, { kind: "daily", playbackMode: "audio", id: "daily-audio-fixture", runId: "daily-fixture-run", dateKey: "2026-08-27" })
  await page.goto("/game")
  await completeRun(page, dailyTracks.map((item) => item.name))
})

test("@smoke @lyrics completes the five-track lyrics run", async ({ page }) => {
  await seedGame(page, lyricsTracks, { kind: "lyrics", playbackMode: "lyrics", id: "lyrics-fixture", runId: "lyrics-fixture-run" })
  await page.goto("/game")
  await expect(page.getByText("Partial Lyrics Mode", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Play preview")).toHaveCount(0)
  await completeRun(page, lyricsTracks.map((item) => item.name))
})

test("@smoke @genre completes a five-track genre run", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedGame(page, genreTracks, { kind: "genre", playbackMode: "audio", id: "genre-vpop", runId: "genre-fixture-run", genre: "vpop" })
  await page.goto("/game")
  await expect(page.getByText("Mode: VPOP Practice")).toBeVisible()
  await completeRun(page, genreTracks.map((item) => item.name))
  await expect(page.getByText("Genre Practice Complete")).toBeVisible()
})

test("@smoke @playlist completes a mixed playlist run", async ({ page }) => {
  await mockYouTubeIframe(page)
  await seedGame(page, playlistTracks, { kind: "playlist", playbackMode: "audio", id: "playlist-fixture", runId: "playlist-fixture-run", playlistSource: "spotify" })
  await page.goto("/game")
  await expect(page.getByText("Mode: Audio Playlist Mode")).toBeVisible()
  await completeRun(page, playlistTracks.map((item) => item.name))
})
