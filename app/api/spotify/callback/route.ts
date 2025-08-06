import { type NextRequest, NextResponse } from "next/server"
import { SPOTIFY_CONFIG, SPOTIFY_ENDPOINTS } from "@/lib/spotify-config"

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()
    
    console.log("Callback received code:", code)
    console.log("Client ID:", SPOTIFY_CONFIG.CLIENT_ID)
    console.log("Redirect URI:", SPOTIFY_CONFIG.REDIRECT_URI)

    const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${SPOTIFY_CONFIG.CLIENT_ID}:${SPOTIFY_CONFIG.CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
      }),
    })

    const data = await response.json()
    console.log("Spotify response:", data)

    if (data.error) {
      console.error("Spotify error:", data.error)
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    })
  } catch (error) {
    console.error("Error in callback:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
