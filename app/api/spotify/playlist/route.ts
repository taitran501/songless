import { type NextRequest, NextResponse } from "next/server"
import type { GameTrack } from "@/lib/tracks"
import { SPOTIFY_CONFIG, SPOTIFY_ENDPOINTS } from "@/lib/spotify-config"

async function getClientCredentialsToken() {
  if (!SPOTIFY_CONFIG.CLIENT_ID || !SPOTIFY_CONFIG.CLIENT_SECRET) {
    return null
  }

  const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CONFIG.CLIENT_ID}:${SPOTIFY_CONFIG.CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  })

  if (!response.ok) {
    console.error("Spotify client credentials token request failed:", response.status)
    return null
  }

  const data = await response.json()
  return typeof data.access_token === "string" ? data.access_token : null
}

function getSpotifyErrorMessage(status: number, hasUserToken: boolean) {
  if ((status === 401 || status === 403) && !hasUserToken) {
    return "Connect Spotify to load private Spotify playlists."
  }

  return "Failed to fetch playlist"
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const playlistId = searchParams.get("playlistId")

    if (!playlistId) {
      return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 })
    }

    const authHeader = request.headers.get("authorization")
    const userAccessToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : ""
    const accessToken = userAccessToken || (await getClientCredentialsToken())

    if (!accessToken) {
      return NextResponse.json(
        { error: "Spotify playlist loading is not configured for guest mode." },
        { status: 503 }
      )
    }

    let playlistName = `Playlist #${playlistId}`
    const metadataResponse = await fetch(
      `${SPOTIFY_ENDPOINTS.API_BASE}/playlists/${playlistId}?fields=name`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json()
      if (typeof metadata.name === "string" && metadata.name.trim()) {
        playlistName = metadata.name
      }
    } else if (metadataResponse.status === 401 || metadataResponse.status === 403) {
      return NextResponse.json(
        { error: getSpotifyErrorMessage(metadataResponse.status, Boolean(userAccessToken)) },
        { status: metadataResponse.status }
      )
    }

    const allTracks: any[] = []
    let offset = 0
    const limit = 100

    while (true) {
      const response = await fetch(
        `${SPOTIFY_ENDPOINTS.API_BASE}/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        return NextResponse.json(
          { error: getSpotifyErrorMessage(response.status, Boolean(userAccessToken)) },
          { status: response.status }
        )
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
      .filter((item: any) => {
        // Filter out items without track or with null track
        return item && item.track && item.track.uri && item.track.name
      })
      .map((item: any) => {
        try {
          return {
            source: "spotify",
            uri: item.track.uri,
            name: item.track.name,
            artists: item.track.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
            duration_ms: item.track.duration_ms || 0,
            albumImage: item.track.album?.images?.[0]?.url ?? null,
            preview_url: item.track.preview_url || null,
          } satisfies GameTrack
        } catch (error) {
          console.error("Error mapping track:", error, item)
          return null
        }
      })
      .filter((track: any) => track !== null) // Remove any null tracks from mapping errors

    return NextResponse.json(filteredTracks, {
      headers: {
        "x-playlist-name": encodeURIComponent(playlistName),
      },
    })
  } catch (error) {
    console.error("Error fetching playlist:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
