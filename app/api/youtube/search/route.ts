import { NextRequest, NextResponse } from "next/server"
import { searchYouTubeVideo, YouTubeError } from "@/lib/youtube"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const title = searchParams.get("title")
    const artists = searchParams.get("artists")

    if (!title || !artists) {
      return NextResponse.json(
        { error: "Query parameters 'title' and 'artists' are required." },
        { status: 400 }
      )
    }

    return NextResponse.json(await searchYouTubeVideo(title, artists))
  } catch (error) {
    if (error instanceof YouTubeError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("YouTube search failed:", error)
    return NextResponse.json({ error: "Internal server error during YouTube search." }, { status: 500 })
  }
}
