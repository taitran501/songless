import { NextRequest, NextResponse } from "next/server"
import { searchYouTubeVideo, YouTubeError } from "@/lib/youtube"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    if (!query) {
      return NextResponse.json({ error: "Query parameter 'q' is required." }, { status: 400 })
    }

    return NextResponse.json(await searchYouTubeVideo(query))
  } catch (error) {
    if (error instanceof YouTubeError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("YouTube search failed:", error)
    return NextResponse.json({ error: "Internal server error during YouTube search." }, { status: 500 })
  }
}
