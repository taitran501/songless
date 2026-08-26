import { type NextRequest, NextResponse } from "next/server"
import { generateLiveDailyTracks } from "@/lib/dynamic-daily-service"
import { getUtcDateKey } from "@/lib/curated-tracks"

export const dynamic = "force-dynamic"
export const maxDuration = 30 // Allow up to 30s on Vercel for live crawl
export const revalidate = 86400 // 24 hours

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateKey = searchParams.get("date") || getUtcDateKey()

    const tracks = await generateLiveDailyTracks(dateKey)

    return NextResponse.json(
      {
        dateKey,
        tracks,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    )
  } catch (error: any) {
    console.error("[API /api/daily] Error generating dynamic daily:", error)
    return NextResponse.json(
      { error: "Failed to generate dynamic daily challenge", details: error.message },
      { status: 500 }
    )
  }
}
