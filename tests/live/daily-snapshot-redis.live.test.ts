import assert from "node:assert/strict"
import test from "node:test"
import { createRedisDailySnapshotStore } from "@/lib/daily-snapshot-redis"
import { createDailySnapshot } from "@/lib/daily-snapshot"
import { selectDailyTracks } from "@/lib/curated-tracks"

const hasRedisCredentials =
  Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
  Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
const enabled = process.env.DAILY_REDIS_LIVE_TEST === "1" && hasRedisCredentials

test(
  "managed Redis preserves an immutable Daily snapshot and lock ownership",
  { skip: !enabled },
  async () => {
    const store = createRedisDailySnapshotStore()
    // Reserved historical date keeps this opt-in probe separate from today's
    // production snapshot. The snapshot is intentionally TTL-bound by the adapter.
    const dateKey = "2000-01-01"
    const snapshot = createDailySnapshot({
      dateKey,
      tracks: selectDailyTracks(dateKey),
      source: "curated",
    })

    const firstWrite = await store.putIfAbsent(snapshot)
    const readBack = await store.get(dateKey)
    assert.ok(readBack)
    assert.equal(readBack.checksum, snapshot.checksum)
    if (!firstWrite) {
      assert.equal(readBack.dateKey, dateKey)
    }

    const token = await store.acquireLock(dateKey, 30)
    assert.ok(token)
    assert.equal(await store.acquireLock(dateKey, 30), null)
    await store.releaseLock(dateKey, token)
    const replacementToken = await store.acquireLock(dateKey, 30)
    assert.ok(replacementToken)
    await store.releaseLock(dateKey, replacementToken)
  }
)
