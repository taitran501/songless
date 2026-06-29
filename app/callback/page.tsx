"use client"

import { useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setTokens } = useSpotifyAuth()
  const hasProcessed = useRef(false)

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed.current) {
      return
    }

    const code = searchParams.get("code")
    const error = searchParams.get("error")

    if (error) {
      console.error("Spotify auth error:", error)
      hasProcessed.current = true
      router.push("/")
      return
    }

    if (code) {
      hasProcessed.current = true
      
      // Exchange code for tokens
      fetch("/api/spotify/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          code,
          redirect_uri: window.location.origin + "/callback"
        }),
      })
        .then(async (response) => {
          const data = await response.json()
          if (!response.ok) {
            throw new Error(data.error || "Failed to exchange Spotify code")
          }
          return data
        })
        .then((data) => {
          if (data.access_token) {
            setTokens(data.access_token, data.refresh_token, data.expires_in)
            router.replace("/playlist") // Use replace instead of push
          } else {
            console.error("Failed to get access token")
            router.replace("/")
          }
        })
        .catch((error) => {
          console.error("Error exchanging code:", error)
          router.replace("/")
        })
    } else {
      // No code, redirect immediately
      hasProcessed.current = true
      router.replace("/")
    }
  }, []) // Empty dependency array to run only once

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">SonglessUnlimited</h1>
        <p className="text-gray-400">Processing authentication...</p>
      </div>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">SonglessUnlimited</h1>
          <p className="text-gray-400">Processing authentication...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
