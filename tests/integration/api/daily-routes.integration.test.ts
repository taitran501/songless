import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"
import { handleCronGet } from "@/lib/cron-daily-route-handler"
import { handleDailyGet } from "@/lib/daily-route-handler"
import { DailySnapshotStoreUnavailableError } from "@/lib/daily-snapshot-redis"
import type { DailySnapshot, DailySnapshotStore } from "@/lib/daily-snapshot"
import { dailyTracks } from "@/tests/fixtures/tracks"

class MemoryDailySnapshotStore implements DailySnapshotStore {
  readonly snapshots = new Map<string, DailySnapshot>()
  readonly locks = new Map<string, string>()

  async get(dateKey: string) {
    return this.snapshots.get(dateKey) ?? null
  }

  async putIfAbsent(snapshot: DailySnapshot) {
    if (this.snapshots.has(snapshot.dateKey)) return false
    this.snapshots.set(snapshot.dateKey, snapshot)
    return true
  }

  async acquireLock(dateKey: string) {
    if (this.locks.has(dateKey)) return null
    const token = `test-lock-${dateKey}`
    this.locks.set(dateKey, token)
    return token
  }

  async releaseLock(dateKey: string, token: string) {
    if (this.locks.get(dateKey) === token) this.locks.delete(dateKey)
  }
}

class FailingDailySnapshotStore implements DailySnapshotStore {
  async get(_dateKey: string): Promise<DailySnapshot | null> {
    throw new DailySnapshotStoreUnavailableError("Redis outage")
  }

  async putIfAbsent(_snapshot: DailySnapshot): Promise<boolean> {
    throw new DailySnapshotStoreUnavailableError("Redis outage")
  }

  async acquireLock(_dateKey: string, _ttlSeconds: number): Promise<string | null> {
    throw new DailySnapshotStoreUnavailableError("Redis outage")
  }

  async releaseLock(_dateKey: string, _token: string): Promise<void> {}
}

const dateKey = "2026-08-27"
const request = (url: string, headers?: Record<string, string>) =>
  new NextRequest(url, { headers })

test("/api/daily returns a validated immutable snapshot", async () => {
  const store = new MemoryDailySnapshotStore()
  const generate = async () => dailyTracks

  const firstResponse = await handleDailyGet(
    request(`http://localhost/api/daily?date=${dateKey}`),
    store,
    generate
  )
  const firstBody = await firstResponse.json()

  assert.equal(firstResponse.status, 200)
  assert.equal(firstBody.dateKey, dateKey)
  assert.equal(firstBody.snapshotVersion, 1)
  assert.equal(firstBody.tracks.length, 3)
  assert.match(firstBody.checksum, /^sha256:/)
  assert.match(firstResponse.headers.get("cache-control") ?? "", /s-maxage=86400/)

  const defaultDateResponse = await handleDailyGet(
    request("http://localhost/api/daily"),
    store,
    async () => dailyTracks
  )
  assert.equal(defaultDateResponse.status, 200)
  assert.equal(defaultDateResponse.headers.get("cache-control"), "no-store")

  const secondResponse = await handleDailyGet(
    request(`http://localhost/api/daily?date=${dateKey}`),
    store,
    async () => {
      throw new Error("the immutable snapshot should be reused")
    }
  )
  const secondBody = await secondResponse.json()
  assert.equal(secondResponse.status, 200)
  assert.equal(secondBody.checksum, firstBody.checksum)
})

test("/api/daily rejects malformed dates and fails closed on Redis outage", async () => {
  const malformed = await handleDailyGet(
    request("http://localhost/api/daily?date=2026-02-30"),
    new MemoryDailySnapshotStore(),
    async () => dailyTracks
  )
  assert.equal(malformed.status, 400)

  const unavailable = await handleDailyGet(
    request(`http://localhost/api/daily?date=${dateKey}`),
    new FailingDailySnapshotStore(),
    async () => dailyTracks
  )
  assert.equal(unavailable.status, 503)
  assert.equal((await unavailable.json()).code, "DAILY_UNAVAILABLE")
})

test("cron authorization and publish are idempotent", async () => {
  const previousSecret = process.env.CRON_SECRET
  const previousVercelEnv = process.env.VERCEL_ENV
  process.env.CRON_SECRET = "integration-secret"
  delete process.env.VERCEL_ENV

  try {
    const store = new MemoryDailySnapshotStore()
    const generate = async () => dailyTracks

    const unauthorized = await handleCronGet(
      request("http://localhost/api/cron/daily"),
      store,
      generate
    )
    assert.equal(unauthorized.status, 401)

    const first = await handleCronGet(
      request("http://localhost/api/cron/daily", {
        authorization: "Bearer integration-secret",
      }),
      store,
      generate
    )
    const firstBody = await first.json()
    assert.equal(first.status, 200)
    assert.equal(firstBody.published, true)

    const second = await handleCronGet(
      request("http://localhost/api/cron/daily", {
        authorization: "Bearer integration-secret",
      }),
      store,
      async () => {
        throw new Error("the second cron call must not regenerate")
      }
    )
    const secondBody = await second.json()
    assert.equal(second.status, 200)
    assert.equal(secondBody.published, false)
    assert.equal(secondBody.checksum, firstBody.checksum)
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previousSecret
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousVercelEnv
  }
})

test("cron fails closed when Production has no cron secret", async () => {
  const previousSecret = process.env.CRON_SECRET
  const previousVercelEnv = process.env.VERCEL_ENV
  delete process.env.CRON_SECRET
  process.env.VERCEL_ENV = "production"

  try {
    const response = await handleCronGet(
      request("http://localhost/api/cron/daily"),
      new MemoryDailySnapshotStore(),
      async () => dailyTracks
    )
    assert.equal(response.status, 503)
  } finally {
    if (previousSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previousSecret
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previousVercelEnv
  }
})
