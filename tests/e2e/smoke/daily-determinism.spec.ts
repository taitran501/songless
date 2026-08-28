import { expect, test } from "@playwright/test"

const todayDateKey = new Date().toISOString().slice(0, 10)

const dailyPayload = {
  dateKey: todayDateKey,
  snapshotVersion: 1,
  checksum: `sha256:${"1".repeat(64)}`,
  tracks: [
    {
      source: "youtube",
      uri: "youtube:daily-vpop",
      videoId: "daily-vpop",
      name: "Daily VPop",
      artists: "VPop Artist",
      duration_ms: 180000,
      albumImage: null,
      preview_url: null,
      genre: "vpop",
      genreEvidence: "allowlist",
      dailyEligible: true,
      audioStartSeconds: 12,
      audioAnalysisStatus: "approved",
      sourceType: "official_audio",
    },
    {
      source: "youtube",
      uri: "youtube:daily-usuk",
      videoId: "daily-usuk",
      name: "Daily USUK",
      artists: "USUK Artist",
      duration_ms: 180000,
      albumImage: null,
      preview_url: null,
      genre: "usuk",
      genreEvidence: "allowlist",
      dailyEligible: true,
      audioStartSeconds: 9,
      audioAnalysisStatus: "approved",
      sourceType: "official_audio",
    },
    {
      source: "youtube",
      uri: "youtube:daily-rap",
      videoId: "daily-rap",
      name: "Daily Rap",
      artists: "Rap Artist",
      duration_ms: 180000,
      albumImage: null,
      preview_url: null,
      genre: "rap",
      genreEvidence: "allowlist",
      dailyEligible: true,
      audioStartSeconds: 15,
      audioAnalysisStatus: "approved",
      sourceType: "official_audio",
    },
  ],
}

test("@smoke @daily gives both browser contexts the same Daily checksum", async ({ browser }) => {
  // This journey intentionally opens two isolated contexts. Allow a cold
  // Next dev server enough time to compile /game before asserting parity.
  test.setTimeout(60_000)

  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ])
  const pages = await Promise.all(contexts.map((context) => context.newPage()))

  try {
    for (const page of pages) {
      await page.route("**/api/daily?date=*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(dailyPayload),
        })
      })
    }

    // Compile the gameplay route before both contexts navigate concurrently.
    // In a cold Next dev server, parallel route compilation can otherwise make
    // one click complete its API request while the client navigation is still
    // waiting on the first /game bundle.
    for (const page of pages) {
      await page.goto("/game")
      await page.goto("/")
    }

    const responses = await Promise.all(
      pages.map(async (page) => {
        await page.goto("/")
        const responsePromise = page.waitForResponse("**/api/daily?date=*")
        await page.getByRole("button", { name: "Start Today's Challenge" }).click()
        const response = await responsePromise
        const body = await response.json()
        await expect(page).toHaveURL(/\/game/, { timeout: 15_000 })
        await expect(page.getByText("Track 1 of 3")).toBeVisible({ timeout: 15_000 })
        return body as { checksum: string; tracks: Array<{ uri: string }> }
      })
    )

    expect(responses[0].checksum).toBe(responses[1].checksum)
    expect(responses[0].tracks.map((track) => track.uri)).toEqual(
      responses[1].tracks.map((track) => track.uri)
    )
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
