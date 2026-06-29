import { type NextRequest, NextResponse } from "next/server"
import { SPOTIFY_CONFIG, SPOTIFY_ENDPOINTS } from "@/lib/spotify-config"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { code, redirect_uri } = await request.json()
    const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${SPOTIFY_CONFIG.CLIENT_ID}:${SPOTIFY_CONFIG.CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect_uri || SPOTIFY_CONFIG.REDIRECT_URI,
      }),
    })

    const data = await response.json()

    if (data.error) {
      console.error("Spotify error:", data.error)
      return NextResponse.json({ error: data.error }, { status: 400 })
    }

    const cookieStore = await cookies()
    
    // Set Access Token cookie
    cookieStore.set("spotify_access_token", data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: data.expires_in,
      path: "/",
    })

    // Set Refresh Token cookie if present
    if (data.refresh_token) {
      cookieStore.set("spotify_refresh_token", data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      })
    }

    // Set Expires At cookie to help keep client and server in sync
    const expiresAt = Date.now() + data.expires_in * 1000
    cookieStore.set("spotify_expires_at", expiresAt.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    })

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
