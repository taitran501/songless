import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("spotify_access_token")?.value || null
    const refreshToken = cookieStore.get("spotify_refresh_token")?.value || null

    if (!accessToken) {
      return NextResponse.json({
        accessToken: null,
        refreshToken: null,
        expiresAt: 0,
      })
    }

    const expiresAtVal = cookieStore.get("spotify_expires_at")?.value
    const expiresAt = expiresAtVal ? parseInt(expiresAtVal) : Date.now() + 3600000

    return NextResponse.json({
      accessToken,
      refreshToken,
      expiresAt,
    })
  } catch (error) {
    console.error("Error in session route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
