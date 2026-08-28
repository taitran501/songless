import assert from "node:assert/strict"
import test from "node:test"
import {
  createRedisDailySnapshotStore,
  DailySnapshotStoreUnavailableError,
} from "@/lib/daily-snapshot-redis"
import { getDailySnapshotKey, getDailySnapshotLockKey } from "@/lib/daily-snapshot"
import { dailyTracks } from "@/tests/fixtures/tracks"
import { createDailySnapshot } from "@/lib/daily-snapshot"

function createFakeRedis() {
  const values = new Map<string, unknown>()
  const redis = {
    async get(key: string) {
      return values.get(key) ?? null
    },
    async set(
      key: string,
      value: unknown,
      options?: { nx?: boolean; ex?: number }
    ) {
      if (options?.nx && values.has(key)) return null
      values.set(key, value)
      return "OK"
    },
    createScript() {
      return {
        async eval(keys: string[], args: string[]) {
          const [key] = keys
          const [token] = args
          if (values.get(key) !== token) return 0
          values.delete(key)
          return 1
        },
      }
    },
  }
  return { redis, values }
}

function snapshot() {
  return createDailySnapshot({
    dateKey: "2026-08-27",
    source: "curated",
    tracks: dailyTracks,
    generatedAt: "2026-08-27T00:00:00.000Z",
  })
}

test("Redis adapter serializes snapshots and preserves the first write", async () => {
  const { redis, values } = createFakeRedis()
  const store = createRedisDailySnapshotStore(redis as never)
  const first = snapshot()

  assert.equal(await store.putIfAbsent(first), true)
  assert.equal(await store.putIfAbsent({ ...first, generatedAt: "2026-08-27T01:00:00.000Z" }), false)
  assert.deepEqual(await store.get(first.dateKey), first)
  assert.equal(typeof values.get(getDailySnapshotKey(first.dateKey)), "string")
})

test("Redis adapter uses a token-checked date lock", async () => {
  const { redis, values } = createFakeRedis()
  const store = createRedisDailySnapshotStore(redis as never)

  const firstToken = await store.acquireLock("2026-08-27", 60)
  const secondToken = await store.acquireLock("2026-08-27", 60)
  assert.ok(firstToken)
  assert.equal(secondToken, null)
  assert.equal(values.get(getDailySnapshotLockKey("2026-08-27")), firstToken)

  await store.releaseLock("2026-08-27", "wrong-token")
  assert.equal(values.get(getDailySnapshotLockKey("2026-08-27")), firstToken)
  await store.releaseLock("2026-08-27", firstToken)
  assert.equal(values.has(getDailySnapshotLockKey("2026-08-27")), false)
})

test("Redis adapter converts provider failures into an unavailable error", async () => {
  const failingRedis = {
    async get() {
      throw new Error("connection refused")
    },
    async set() {
      throw new Error("connection refused")
    },
    createScript() {
      return { eval: async () => 0 }
    },
  }
  const store = createRedisDailySnapshotStore(failingRedis as never)

  await assert.rejects(store.get("2026-08-27"), DailySnapshotStoreUnavailableError)
})
