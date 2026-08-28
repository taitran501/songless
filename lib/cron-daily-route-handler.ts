import { type NextRequest, NextResponse } from "next/server"
import {
  DailySnapshotUnavailableError,
  publishDailySnapshot,
  type DailyTrackGenerator,
} from "@/lib/dynamic-daily-service"
import {
  DailySnapshotStoreUnavailableError,
  getDailySnapshotStore,
} from "@/lib/daily-snapshot-redis"
import type { DailySnapshotStore } from "@/lib/daily-snapshot"
import { getUtcDateKey } from "@/lib/curated-tracks"
import { recordDailyMetric } from "@/lib/daily-observability"

export async function handleCronGet(
  request: NextRequest,
  store?: DailySnapshotStore,
  generate?: DailyTrackGenerator
) {
  const dateKey = getUtcDateKey()
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    const isProduction =
      process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"

    if (!cronSecret && isProduction) {
      return NextResponse.json({ error: "Cron secret is not configured." }, { status: 503 })
    }
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const snapshotStore = store ?? getDailySnapshotStore()
    const { snapshot, created } = await publishDailySnapshot(dateKey, snapshotStore, generate)

    return NextResponse.json({
      success: true,
      message: created
        ? `Successfully published Daily snapshot for ${dateKey}`
        : `Daily snapshot for ${dateKey} already exists`,
      dateKey,
      published: created,
      checksum: snapshot.checksum,
      tracksCount: snapshot.tracks.length,
      tracks: snapshot.tracks.map((track) => ({
        genre: track.genre,
        name: track.name,
        artists: track.artists,
        uri: track.uri,
        hasLyrics: Boolean(track.lyricsSnippets && track.lyricsSnippets.length > 0),
      })),
    })
  } catch (error: unknown) {
    console.error("[CRON /api/cron/daily] Execution failed:", error)
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
      error instanceof DailySnapshotStoreUnavailableError ||
      error instanceof DailySnapshotUnavailableError
        ? 503
        : 500
    return NextResponse.json(
      { success: false, error: "Daily snapshot publication failed.", code: "DAILY_UNAVAILABLE" },
      { status, headers: { "Cache-Control": "no-store" } }
    )
  }
}
