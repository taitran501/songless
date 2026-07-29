export const SPOTIFY_CONFIG = {
  CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || "",
  CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || "",
} as const

export const SPOTIFY_ENDPOINTS = {
  TOKEN: "https://accounts.spotify.com/api/token",
  API_BASE: "https://api.spotify.com/v1",
} as const
