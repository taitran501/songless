"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSpotifyAuthUrl } from "@/lib/spotify-config"

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if user already has access token
    const accessToken = localStorage.getItem("spotify_access_token")
    if (accessToken) {
      router.push("/playlist")
      return
    }

    // Redirect to Spotify authorization
    const authUrl = getSpotifyAuthUrl()
    window.location.href = authUrl
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">SonglessUnlimited</h1>
        <p className="text-gray-400">Redirecting to Spotify...</p>
      </div>
    </div>
  )
}
