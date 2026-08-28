import { randomUUID } from "node:crypto"
import { Redis } from "@upstash/redis"
import {
  DAILY_SNAPSHOT_TTL_SECONDS,
  getDailySnapshotKey,
  getDailySnapshotLockKey,
  parseDailySnapshot,
  type DailySnapshot,
  type DailySnapshotStore,
} from "@/lib/daily-snapshot"

export class DailySnapshotStoreUnavailableError extends Error {
  constructor(message = "Daily snapshot storage is unavailable.") {
    super(message)
    this.name = "DailySnapshotStoreUnavailableError"
  }
}

function getRedisClient() {
  const hasUpstashCredentials =
    Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  const url = hasUpstashCredentials
    ? process.env.UPSTASH_REDIS_REST_URL
    : process.env.KV_REST_API_URL
  const token = hasUpstashCredentials
    ? process.env.UPSTASH_REDIS_REST_TOKEN
    : process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    throw new DailySnapshotStoreUnavailableError(
      "Daily snapshot Redis credentials are not configured."
    )
  }

  return new Redis({ url, token })
}

export function createRedisDailySnapshotStore(redisClient = getRedisClient()): DailySnapshotStore {
  const releaseLockScript = redisClient.createScript<number>(
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end'
  )

  return {
    async get(dateKey) {
      try {
        const raw = await redisClient.get<unknown>(getDailySnapshotKey(dateKey))
        if (raw === null || raw === undefined) return null
        return parseDailySnapshot(raw)
      } catch (error) {
        if (error instanceof DailySnapshotStoreUnavailableError) throw error
        throw new DailySnapshotStoreUnavailableError(
          error instanceof Error ? error.message : "Could not read Daily snapshot."
        )
      }
    },

    async putIfAbsent(snapshot: DailySnapshot) {
      try {
        const result = await redisClient.set(
          getDailySnapshotKey(snapshot.dateKey),
          JSON.stringify(snapshot),
          { nx: true, ex: DAILY_SNAPSHOT_TTL_SECONDS }
        )
        return result === "OK"
      } catch (error) {
        throw new DailySnapshotStoreUnavailableError(
          error instanceof Error ? error.message : "Could not write Daily snapshot."
        )
      }
    },

    async acquireLock(dateKey, ttlSeconds) {
      const token = randomUUID()
      try {
        const result = await redisClient.set(
          getDailySnapshotLockKey(dateKey),
          token,
          { nx: true, ex: ttlSeconds }
        )
        return result === "OK" ? token : null
      } catch (error) {
        throw new DailySnapshotStoreUnavailableError(
          error instanceof Error ? error.message : "Could not acquire Daily snapshot lock."
        )
      }
    },

    async releaseLock(dateKey, token) {
      try {
        await releaseLockScript.eval([getDailySnapshotLockKey(dateKey)], [token])
      } catch (error) {
        throw new DailySnapshotStoreUnavailableError(
          error instanceof Error ? error.message : "Could not release Daily snapshot lock."
        )
      }
    },
  }
}

let defaultStore: DailySnapshotStore | null = null

export function getDailySnapshotStore() {
  if (!defaultStore) defaultStore = createRedisDailySnapshotStore()
  return defaultStore
}

export function resetDailySnapshotStoreForTests() {
  defaultStore = null
}
