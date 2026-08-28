import { expect, test, type Page } from "@playwright/test"

const todayDateKey = new Date().toISOString().slice(0, 10)

const dailyTracks = [
  { source: "youtube", uri: "youtube:daily-vpop", videoId: "daily-vpop", name: "Daily VPop", artists: "VPop Artist", duration_ms: 180000, albumImage: null, preview_url: null, genre: "vpop", genreEvidence: "allowlist", audioStartSeconds: 12, audioAnalysisStatus: "approved", dailyEligible: true, sourceType: "official_audio" },
  { source: "youtube", uri: "youtube:daily-usuk", videoId: "daily-usuk", name: "Daily USUK", artists: "USUK Artist", duration_ms: 180000, albumImage: null, preview_url: null, genre: "usuk", genreEvidence: "allowlist", audioStartSeconds: 9, audioAnalysisStatus: "approved", dailyEligible: true, sourceType: "official_audio" },
  { source: "youtube", uri: "youtube:daily-rap", videoId: "daily-rap", name: "Daily Rap", artists: "Rap Artist", duration_ms: 180000, albumImage: null, preview_url: null, genre: "rap", genreEvidence: "allowlist", audioStartSeconds: 15, audioAnalysisStatus: "approved", dailyEligible: true, sourceType: "official_audio" },
]

async function mockYouTubeIframe(page: Page) {
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `(() => { class Player { constructor(id, config) { setTimeout(() => config.events?.onReady?.({ target: this }), 0); } cueVideoById() {} seekTo() {} playVideo() {} pauseVideo() {} stopVideo() {} unMute() {} setVolume() {} } window.YT = { Player }; setTimeout(() => window.onYouTubeIframeAPIReady?.(), 0); })();`,
    })
  })
}

test("@smoke starts a deterministic daily challenge from Home", async ({ page }) => {
  await mockYouTubeIframe(page)
  await page.route("**/api/daily?date=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dateKey: todayDateKey,
        snapshotVersion: 1,
        checksum: `sha256:${"0".repeat(64)}`,
        tracks: dailyTracks,
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Start Today's Challenge" }).click()

  await expect(page).toHaveURL(/\/game/, { timeout: 15_000 })
  await expect(page.getByText("Track 1 of 3")).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText("Mode: Daily Challenge")).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("game_tracks") || "[]").length))
    .toBe(3)
})

test("@smoke @lyrics starts Lyrics Quick Mix from Home", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start Lyrics Quick Mix" }).click()

  await expect(page.getByText("Track 1 of 5")).toBeVisible()
  await expect(page.getByText("Mode: Partial Lyrics Mode")).toBeVisible()
})

test("@smoke @genre starts VPop practice from Home", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /^VPop/ }).click()

  await expect(page.getByText("Track 1 of 5")).toBeVisible()
  await expect(page.getByText("Mode: VPOP Practice")).toBeVisible()
})
