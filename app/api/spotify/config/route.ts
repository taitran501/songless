import { NextResponse } from 'next/server'

export async function GET() {
  const config = {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/api/spotify/callback",
    scopes: [
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-modify-playback-state",
      "user-read-playback-state",
      "playlist-read-private",
      "playlist-read-collaborative"
    ].join(" ")
  }

  return NextResponse.json(config)
} 