import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const playlistId = searchParams.get("playlistId")

    if (!playlistId) {
      return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 })
    }

    // Get access token from request headers or you might need to implement a different way
    // For now, we'll assume the client sends it
    const authHeader = request.headers.get("authorization")
    let accessToken = ""

    if (authHeader && authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7)
    } else {
      // In a real app, you'd handle this differently
      return NextResponse.json({ error: "Access token required" }, { status: 401 })
    }

    const allTracks: any[] = []
    let offset = 0
    const limit = 100

    while (true) {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch playlist" }, { status: response.status })
      }

      const data = await response.json()
      const tracks = data.items

      if (tracks.length === 0) {
        break // No more tracks
      }

      allTracks.push(...tracks)
      offset += limit

      // Safety check to prevent infinite loops
      if (offset > 1000) {
        console.warn("Playlist too large, stopping at 1000 tracks")
        break
      }
    }

    const filteredTracks = allTracks
      .filter((item: any) => item.track)  // chỉ đảm bảo có track obj
      .map((item: any) => ({
        uri: item.track.uri,
        name: item.track.name,
        duration_ms: item.track.duration_ms,
        albumImage: item.track.album?.images?.[0]?.url ?? null,
      }))

    return NextResponse.json(filteredTracks)
  } catch (error) {
    console.error("Error fetching playlist:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
