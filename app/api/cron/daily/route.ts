import { type NextRequest, NextResponse } from "next/server"
import { generateLiveDailyTracks } from "@/lib/dynamic-daily-service"
import { getUtcDateKey } from "@/lib/curated-tracks"

export const dynamic = "force-dynamic"
export const maxDuration = 30 // Allow up to 30s on Vercel for autonomous crawl

/**
 * Autonomous Cron Route for Daily Ingestion.
 * Triggered at 00:00 UTC daily to ingest today's Top Charts and prepare the Daily Challenge.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    // If CRON_SECRET is configured, check authorization
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dateKey = getUtcDateKey()
    const tracks = await generateLiveDailyTracks(dateKey)

    return NextResponse.json({
      success: true,
      message: `Successfully ingested and generated daily challenge for ${dateKey}`,
      dateKey,
      tracksCount: tracks.length,
      tracks: tracks.map((t) => ({
        genre: t.genre,
        name: t.name,
        artists: t.artists,
        uri: t.uri,
        hasLyrics: Boolean(t.lyricsSnippets && t.lyricsSnippets.length > 0),
      })),
    })
  } catch (error: any) {
    console.error("[CRON /api/cron/daily] Execution failed:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
