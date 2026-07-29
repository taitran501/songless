import { defineConfig, devices } from "@playwright/test"

const usesExternalServer = process.env.SONGLESS_E2E_EXTERNAL_SERVER === "1"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: usesExternalServer
    ? undefined
    : {
        command: "node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: false,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          SPOTIFY_CLIENT_ID: "test-client-id",
          SPOTIFY_CLIENT_SECRET: "test-client-secret",
        },
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
