import { NextRequest, NextResponse } from "next/server"
import { parseYouTubePlaylist, YouTubeError } from "@/lib/youtube"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const input = searchParams.get("url") || searchParams.get("playlistId")

    if (!input) {
      return NextResponse.json({ error: "Parameter 'url' or 'playlistId' is required." }, { status: 400 })
    }

    const result = await parseYouTubePlaylist(input)

    return NextResponse.json(result.tracks, {
      headers: {
        "x-playlist-name": encodeURIComponent(result.playlistName),
      },
    })
  } catch (error) {
    if (error instanceof YouTubeError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("YouTube playlist processing failed:", error)
    return NextResponse.json({ error: "Internal server error during playlist processing." }, { status: 500 })
  }
}
