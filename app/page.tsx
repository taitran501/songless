"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2, Music, Youtube } from "lucide-react"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializingSpotify, setInitializingSpotify] = useState(false)
  const { accessToken, isLoading: isAuthLoading } = useSpotifyAuth()

  useEffect(() => {
    if (isAuthLoading) return
    if (accessToken) {
      router.push("/playlist")
    } else {
      setLoading(false)
    }
  }, [accessToken, isAuthLoading, router])

  const handleSpotifyLogin = async () => {
    setInitializingSpotify(true)
    setError(null)
    try {
      const response = await fetch('/api/spotify/config')
      if (!response.ok) throw new Error('Failed to load Spotify configuration')

      const config = await response.json()
      if (!config.clientId) throw new Error("SPOTIFY_CLIENT_ID environment variable is not set")

      const params = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes,
        state: "STATE"
      })

      window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize Spotify auth")
      setInitializingSpotify(false)
    }
  }

  const handleGuestPlay = () => router.push("/playlist")

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-[#dce5d9] flex items-center justify-center font-sans">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#10b981] animate-spin mx-auto mb-4" />
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white mb-2">
            <span className="bg-gradient-to-r from-[#10b981] via-emerald-400 to-[#10b981] bg-clip-text text-transparent">Songless</span>
            <span className="text-white font-light">Unlimited</span>
          </h1>
          <p className="text-[#6b7280] text-sm">Initializing...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-[#dce5d9] flex flex-col font-sans relative overflow-hidden select-none">
      {/* Ambient glows — same as playlist/game pages */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#10b981]/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 relative z-10 py-12">

        {/* Logo / Hero */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/20">
            <Music className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="text-[#10b981] text-xs font-semibold uppercase tracking-widest font-display">Music Guessing Game</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-[#10b981] via-emerald-400 to-[#10b981] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              Songless
            </span>
            <span className="text-white font-light">Unlimited</span>
          </h1>
          <p className="text-[#9ca3af] text-base sm:text-lg max-w-md mx-auto leading-relaxed">
            Listen to a short clip. Guess the song. Beat your best score.
          </p>

          {error && (
            <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4 mt-6 text-left max-w-md mx-auto animate-fade-in flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-display font-semibold text-sm text-red-400">Configuration Error</span>
                <p className="text-red-200 text-xs mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl animate-slide-up">

          {/* Spotify / Pro Mode */}
          <div className="bg-[#090d16]/60 backdrop-blur-xl border border-[#10b981]/20 hover:border-[#10b981]/40 rounded-2xl p-7 flex flex-col items-center text-center transition-all duration-300 relative group overflow-hidden shadow-2xl ring-1 ring-white/5 hover:shadow-[0_0_40px_rgba(16,185,129,0.08)]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#10b981]/3 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="w-14 h-14 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/25 flex items-center justify-center mb-5">
              <Music className="w-7 h-7 text-[#10b981]" />
            </div>

            <span className="text-[10px] text-[#10b981] font-semibold uppercase tracking-widest font-display mb-2">Spotify Connected</span>
            <h2 className="font-display text-xl font-bold text-white mb-2">Full Experience</h2>
            <p className="text-[#6b7280] text-sm leading-relaxed mb-6 flex-1">
              Use any Spotify playlist. Audio previews stream directly. Tracks save your progress.
            </p>

            <Button
              onClick={handleSpotifyLogin}
              disabled={initializingSpotify}
              className="w-full h-11 bg-[#10b981] hover:bg-[#10b981]/90 text-black font-bold rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all duration-300 active:scale-[0.98]"
            >
              {initializingSpotify ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Connect Spotify"
              )}
            </Button>
          </div>

          {/* Guest Mode */}
          <div className="bg-[#090d16]/60 backdrop-blur-xl border border-white/5 hover:border-white/10 rounded-2xl p-7 flex flex-col items-center text-center transition-all duration-300 relative group overflow-hidden shadow-2xl ring-1 ring-white/5">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
              <Youtube className="w-7 h-7 text-red-400" />
            </div>

            <span className="text-[10px] text-red-400 font-semibold uppercase tracking-widest font-display mb-2">No Login Required</span>
            <h2 className="font-display text-xl font-bold text-white mb-2">Guest Mode</h2>
            <p className="text-[#6b7280] text-sm leading-relaxed mb-6 flex-1">
              Load a YouTube playlist or public Spotify playlist and play right away.
            </p>

            <Button
              onClick={handleGuestPlay}
              variant="outline"
              className="w-full h-11 bg-transparent border border-white/10 hover:bg-white/5 text-[#dce5d9] font-semibold rounded-xl transition-all duration-300 active:scale-[0.98]"
            >
              Play as Guest
            </Button>
          </div>

        </div>

        {/* Bottom note */}
        <p className="text-[#4b5563] text-xs mt-10 text-center">
          Public Spotify playlists work in guest mode — no login needed.
        </p>
      </main>
    </div>
  )
}
