import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    cookieStore.delete("spotify_access_token")
    cookieStore.delete("spotify_refresh_token")
    cookieStore.delete("spotify_expires_at")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in logout route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
