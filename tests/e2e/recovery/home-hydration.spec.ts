import { expect, test } from "@playwright/test"

test("@resilience hydrates Home without a date mismatch and uses the browser UTC date", async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.addInitScript(() => {
    const fixedNow = Date.parse("2040-01-02T12:00:00.000Z")
    const NativeDate = Date

    class FixedDate extends NativeDate {
      constructor(value?: string | number | Date) {
        if (value === undefined) {
          super(fixedNow)
        } else {
          super(value)
        }
      }

      static now() {
        return fixedNow
      }
    }

    window.Date = FixedDate as DateConstructor
  })

  await page.goto("/")
  await expect(page.getByTestId("home-daily-card")).toBeVisible()
  await expect(page.getByText("Today · Jan 2, 2040")).toBeVisible()
  await expect(page.getByRole("button", { name: "Start Today's Challenge" })).toBeEnabled()

  expect([...consoleErrors, ...pageErrors].join("\n")).not.toMatch(/React error #418|hydration/i)
})
