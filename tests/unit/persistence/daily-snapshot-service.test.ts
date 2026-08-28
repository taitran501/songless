import assert from "node:assert/strict"
import test from "node:test"
import {
  DailySnapshotUnavailableError,
  publishDailySnapshot,
} from "@/lib/dynamic-daily-service"
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
    const token = `lock-${dateKey}`
    this.locks.set(dateKey, token)
    return token
  }

  async releaseLock(dateKey: string, token: string) {
    if (this.locks.get(dateKey) === token) this.locks.delete(dateKey)
  }
}

const dateKey = "2026-08-27"

test("Daily snapshot publication is immutable and idempotent", async () => {
  const store = new MemoryDailySnapshotStore()
  let calls = 0

  const first = await publishDailySnapshot(dateKey, store, async () => {
    calls += 1
    return dailyTracks
  })
  const second = await publishDailySnapshot(dateKey, store, async () => {
    calls += 1
    return dailyTracks.slice().reverse()
  })

  assert.equal(first.created, true)
  assert.equal(second.created, false)
  assert.equal(first.snapshot.checksum, second.snapshot.checksum)
  assert.equal(calls, 1)
  assert.equal(store.locks.size, 0)
})

test("concurrent Daily generation produces one published snapshot", async () => {
  const store = new MemoryDailySnapshotStore()
  let calls = 0

  const generate = async () => {
    calls += 1
    await new Promise((resolve) => setTimeout(resolve, 150))
    return dailyTracks
  }

  const [first, second] = await Promise.all([
    publishDailySnapshot(dateKey, store, generate),
    publishDailySnapshot(dateKey, store, generate),
  ])

  assert.equal(calls, 1)
  assert.equal(first.snapshot.checksum, second.snapshot.checksum)
  assert.equal(new Set([first.created, second.created]).size, 2)
  assert.equal(store.snapshots.size, 1)
})

test("invalid generated tracks fail closed and release the lock", async () => {
  const store = new MemoryDailySnapshotStore()

  await assert.rejects(
    publishDailySnapshot(dateKey, store, async () => dailyTracks.slice(0, 2)),
    (error: unknown) => error instanceof DailySnapshotUnavailableError
  )
  assert.equal(store.snapshots.size, 0)
  assert.equal(store.locks.size, 0)
})

test("does not serve a snapshot stored under the wrong date", async () => {
  const store = new MemoryDailySnapshotStore()
  const wrongDate = await publishDailySnapshot("2026-08-26", store, async () => dailyTracks)
  store.snapshots.set("2026-08-27", wrongDate.snapshot)

  await assert.rejects(
    publishDailySnapshot("2026-08-27", store, async () => dailyTracks),
    (error: unknown) => error instanceof DailySnapshotUnavailableError
  )
})
