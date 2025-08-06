import { NextResponse } from 'next/server'

export async function GET() {
  // Determine the correct redirect URI based on environment
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NODE_ENV === 'production'
    ? 'https://songless.vercel.app'
    : 'http://localhost:3000'
  
  const config = {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${baseUrl}/api/spotify/callback`,
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