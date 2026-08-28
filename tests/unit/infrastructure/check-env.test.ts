import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import test from "node:test"

const scriptPath = join(process.cwd(), "scripts", "check-env.js")

function runCheck(overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    SPOTIFY_CLIENT_ID: "test-client-id",
    SPOTIFY_CLIENT_SECRET: "test-client-secret",
  }

  for (const key of [
    "VERCEL_ENV",
    "CRON_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
  ]) {
    delete env[key]
  }

  Object.assign(env, overrides)
  return spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  })
}

test("deployment environment contract", async (t) => {
  await t.test("allows Preview without Redis but emits a fail-closed warning", () => {
    const result = runCheck({ VERCEL_ENV: "preview" })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /WARNING Daily Redis is not configured for Preview/)
  })

  await t.test("requires Redis and CRON_SECRET in Production", () => {
    const result = runCheck({ VERCEL_ENV: "production" })
    assert.equal(result.status, 1)
    assert.match(result.stdout, /UPSTASH_REDIS_REST_URL \+ UPSTASH_REDIS_REST_TOKEN/)
    assert.match(result.stdout, /CRON_SECRET/)
  })

  await t.test("passes Production with managed Redis and cron credentials", () => {
    const result = runCheck({
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://redis.example.test",
      UPSTASH_REDIS_REST_TOKEN: "redis-token",
      CRON_SECRET: "cron-secret",
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /All environment variables are set/)
  })
})
