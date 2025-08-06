import { NextRequest, NextResponse } from "next/server"
import { SPOTIFY_CONFIG, SPOTIFY_ENDPOINTS } from "@/lib/spotify-config"

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json()

    if (!refresh_token) {
      return NextResponse.json({ error: "Refresh token required" }, { status: 400 })
    }

    const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${SPOTIFY_CONFIG.CLIENT_ID}:${SPOTIFY_CONFIG.CLIENT_SECRET}`).toString("base64")}`
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh_token
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Spotify refresh error:", data)
      return NextResponse.json({ error: "Failed to refresh token" }, { status: 400 })
    }

    return NextResponse.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refresh_token, // Use new refresh token if provided, otherwise keep old one
      expires_in: data.expires_in
    })
  } catch (error) {
    console.error("Error refreshing token:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 