// Spotify OAuth Configuration
export const SPOTIFY_CONFIG = {
  CLIENT_ID: process.env.SPOTIFY_CLIENT_ID!,
  CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET!,
  REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI || "http://localhost:3000/api/spotify/callback",
  SCOPES: [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "user-read-playback-state",
    "playlist-read-private",
    "playlist-read-collaborative"  
  ].join(" "),
  AUTH_STATE: "STATE"
} as const

// Spotify API endpoints
export const SPOTIFY_ENDPOINTS = {
  AUTHORIZE: "https://accounts.spotify.com/authorize",
  TOKEN: "https://accounts.spotify.com/api/token",
  API_BASE: "https://api.spotify.com/v1"
} as const

// Helper function to generate authorization URL
export function getSpotifyAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CONFIG.CLIENT_ID,
    redirect_uri: SPOTIFY_CONFIG.REDIRECT_URI,
    scope: SPOTIFY_CONFIG.SCOPES,
    state: SPOTIFY_CONFIG.AUTH_STATE
  })
  
  return `${SPOTIFY_ENDPOINTS.AUTHORIZE}?${params.toString()}`
} 