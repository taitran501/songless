import { expect, test } from "@playwright/test"

const todayDateKey = new Date().toISOString().slice(0, 10)

test("@resilience fails closed when the daily provider is unavailable", async ({ page }) => {
  await page.route("**/api/daily?date=*", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "provider unavailable" }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Start Today's Challenge" }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId("daily-error")).toBeVisible()
  await expect(page.getByText("Track 1 of 3")).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() => ({
        session: localStorage.getItem("songless_session_v2"),
        tracks: localStorage.getItem("game_tracks"),
      }))
    )
    .toEqual({ session: null, tracks: null })
})

test("@resilience rejects a malformed Daily payload without creating a run", async ({ page }) => {
  await page.route("**/api/daily?date=*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dateKey: todayDateKey,
        snapshotVersion: 1,
        tracks: [{ name: "Only one track", artists: "Broken payload" }],
      }),
    })
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Start Today's Challenge" }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId("daily-error")).toBeVisible()
  await expect(page.getByText("Track 1 of 3")).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() => ({
        session: localStorage.getItem("songless_session_v2"),
        tracks: localStorage.getItem("game_tracks"),
      }))
    )
    .toEqual({ session: null, tracks: null })
})
