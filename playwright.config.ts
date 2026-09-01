import { defineConfig, devices } from "@playwright/test"

const usesExternalServer = process.env.SONGLESS_E2E_EXTERNAL_SERVER === "1"
const includesLegacy = process.env.SONGLESS_E2E_INCLUDE_LEGACY === "1"

export default defineConfig({
  testDir: "./tests/e2e",
  // The deterministic suite starts one shared Next dev server. Serializing
  // files avoids dev-server/HMR races while the Daily parity test still
  // exercises two isolated browser contexts concurrently.
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  testIgnore: includesLegacy ? undefined : ["**/legacy/**"],
  webServer: usesExternalServer
    ? undefined
    : {
        command: "node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: false,
        stdout: "pipe",
        stderr: "pipe",
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
})
