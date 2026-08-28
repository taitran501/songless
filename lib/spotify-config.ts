export function getSpotifyConfig() {
  return {
    CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || "",
    CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || "",
  } as const
}

// Kept for callers that import the historical constant. Server routes should
// prefer getSpotifyConfig() so runtime-injected environment values are read at
// request time rather than frozen during module evaluation.
export const SPOTIFY_CONFIG = getSpotifyConfig()

export const SPOTIFY_ENDPOINTS = {
  TOKEN: "https://accounts.spotify.com/api/token",
  API_BASE: "https://api.spotify.com/v1",
} as const
