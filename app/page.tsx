"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSpotifyAuthUrl, isSpotifyConfigured } from "@/lib/spotify-config"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if Spotify is configured
    if (!isSpotifyConfigured()) {
      setError("Spotify configuration is missing. Please check environment variables.")
      return
    }

    // Check if user already has access token
    const accessToken = localStorage.getItem("spotify_access_token")
    if (accessToken) {
      router.push("/playlist")
      return
    }

    try {
      // Redirect to Spotify authorization
      const authUrl = getSpotifyAuthUrl()
      window.location.href = authUrl
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to initialize Spotify auth")
    }
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">SonglessUnlimited</h1>
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 mb-4">
            <h2 className="text-red-400 text-lg font-semibold mb-2">Configuration Error</h2>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
            <h3 className="text-blue-400 text-lg font-semibold mb-2">How to fix:</h3>
            <ul className="text-blue-200 text-sm space-y-1 text-left">
              <li>• Check Vercel environment variables</li>
              <li>• Ensure SPOTIFY_CLIENT_ID is set</li>
              <li>• Ensure SPOTIFY_CLIENT_SECRET is set</li>
              <li>• Redeploy the application</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">SonglessUnlimited</h1>
        <p className="text-gray-400">Redirecting to Spotify...</p>
      </div>
    </div>
  )
}
