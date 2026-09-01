#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const baseUrl = "http://127.0.0.1:3100"
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next")
const playwrightCli = path.join(root, "node_modules", "@playwright", "test", "cli.js")
const testArgs = process.argv.slice(2)

function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    })
    return
  }

  child.kill("SIGTERM")
}

async function waitForServer(child, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next test server exited early with code ${child.exitCode}.`)
    }

    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${baseUrl}.`)
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0))
    })
  })
}

async function main() {
  const server = spawn(
    process.execPath,
    [nextCli, "dev", "-H", "127.0.0.1", "-p", "3100"],
    {
      cwd: root,
      env: {
        ...process.env,
      },
      stdio: "inherit",
      windowsHide: true,
    }
  )

  const cleanup = () => stopProcessTree(server)
  process.once("SIGINT", cleanup)
  process.once("SIGTERM", cleanup)

  try {
    await waitForServer(server)
    const tests = spawn(process.execPath, [playwrightCli, "test", ...testArgs], {
      cwd: root,
      env: {
        ...process.env,
        SONGLESS_E2E_EXTERNAL_SERVER: "1",
        SONGLESS_E2E_INCLUDE_LEGACY:
          testArgs.some((arg) => /tests[\\/]e2e[\\/]legacy/.test(arg))
            ? "1"
            : process.env.SONGLESS_E2E_INCLUDE_LEGACY,
      },
      stdio: "inherit",
      windowsHide: true,
    })
    process.exitCode = await waitForExit(tests)
  } finally {
    cleanup()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
