import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { SPOTIFY_CONFIG, SPOTIFY_ENDPOINTS } from "./spotify-config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function refreshSpotifyToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  try {
    const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${SPOTIFY_CONFIG.CLIENT_ID}:${SPOTIFY_CONFIG.CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    })

    const data = await response.json()

    if (data.error) {
      console.error("Token refresh error:", data.error)
      return null
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // Keep old refresh token if new one not provided
      expires_in: data.expires_in,
    }
  } catch (error) {
    console.error("Error refreshing token:", error)
    return null
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = localStorage.getItem("spotify_access_token")
  const refreshToken = localStorage.getItem("spotify_refresh_token")

  if (!accessToken || !refreshToken) {
    return null
  }

  // For now, we'll assume the token is valid
  // In a real app, you'd check the expiration time
  return accessToken
}
