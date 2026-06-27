"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if user already has access token
        const accessToken = localStorage.getItem("spotify_access_token")
        if (accessToken) {
          router.push("/playlist")
          return
        }

        // Get Spotify config from API
        const response = await fetch('/api/spotify/config')
        if (!response.ok) {
          throw new Error('Failed to load Spotify configuration')
        }

        const config = await response.json()
        
        if (!config.clientId) {
          setError("SPOTIFY_CLIENT_ID environment variable is not set")
          setLoading(false)
          return
        }

        // Generate auth URL
        const params = new URLSearchParams({
          response_type: "code",
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: config.scopes,
          state: "STATE"
        })
        
        const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`
        window.location.href = authUrl
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to initialize Spotify auth")
        setLoading(false)
      }
    }

    initializeAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">SonglessUnlimited</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

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
