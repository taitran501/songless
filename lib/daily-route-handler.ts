import { type NextRequest, NextResponse } from "next/server"
import {
  DailySnapshotUnavailableError,
  getOrGenerateDailySnapshot,
  type DailyTrackGenerator,
} from "@/lib/dynamic-daily-service"
import {
  DailySnapshotStoreUnavailableError,
  getDailySnapshotStore,
} from "@/lib/daily-snapshot-redis"
import type { DailySnapshotStore } from "@/lib/daily-snapshot"
import { isValidDateKey } from "@/lib/date-key"
import { getUtcDateKey } from "@/lib/curated-tracks"
import { recordDailyMetric } from "@/lib/daily-observability"

export async function handleDailyGet(
  request: NextRequest,
  store?: DailySnapshotStore,
  generate?: DailyTrackGenerator
) {
  let dateKey = "unknown"
  try {
    const { searchParams } = new URL(request.url)
    const hasExplicitDate = searchParams.has("date")
    dateKey = searchParams.get("date") || getUtcDateKey()
    if (!isValidDateKey(dateKey)) {
      return NextResponse.json({ error: "Invalid Daily date." }, { status: 400 })
    }

    const snapshotStore = store ?? getDailySnapshotStore()
    const snapshot = await getOrGenerateDailySnapshot(dateKey, snapshotStore, generate)

    return NextResponse.json(
      {
        dateKey: snapshot.dateKey,
        snapshotVersion: snapshot.schemaVersion,
        checksum: snapshot.checksum,
        tracks: snapshot.tracks,
      },
      {
        headers: {
          "Cache-Control": hasExplicitDate
            ? "public, s-maxage=86400, stale-while-revalidate=604800"
            : "no-store",
        },
      }
    )
  } catch (error: unknown) {
    console.error("[API /api/daily] Error generating dynamic daily:", error)
    recordDailyMetric("daily_unavailable", {
      dateKey,
      reason:
        error instanceof DailySnapshotStoreUnavailableError
          ? "storage_unavailable"
          : error instanceof DailySnapshotUnavailableError
            ? "snapshot_unavailable"
            : "internal_error",
    })
    const status =
      error instanceof DailySnapshotUnavailableError ||
      error instanceof DailySnapshotStoreUnavailableError
        ? 503
        : 500
    return NextResponse.json(
      {
        error: "Daily challenge is temporarily unavailable.",
        code: "DAILY_UNAVAILABLE",
      },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }
}
