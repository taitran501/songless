import { type NextRequest, NextResponse } from "next/server"
import { SPOTIFY_CONFIG, SPOTIFY_ENDPOINTS } from "@/lib/spotify-config"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    let refresh_token = ""
    try {
      const body = await request.json()
      refresh_token = body?.refresh_token || ""
    } catch {
      // Body is empty or not JSON, fallback to cookie
    }

    if (!refresh_token) {
      const cookieStore = await cookies()
      refresh_token = cookieStore.get("spotify_refresh_token")?.value || ""
    }

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

    const nextAccessToken = data.access_token
    const nextRefreshToken = data.refresh_token || refresh_token
    const expiresIn = data.expires_in

    const cookieStore = await cookies()
    cookieStore.set("spotify_access_token", nextAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn,
      path: "/",
    })
    cookieStore.set("spotify_refresh_token", nextRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    })

    const expiresAt = Date.now() + expiresIn * 1000
    cookieStore.set("spotify_expires_at", expiresAt.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    })

    return NextResponse.json({
      access_token: nextAccessToken,
      refresh_token: nextRefreshToken,
      expires_in: expiresIn
    })
  } catch (error) {
    console.error("Error refreshing token:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}