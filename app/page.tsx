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
    // Check if user already has access token on mount
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
      // Get Spotify config from API
      const response = await fetch('/api/spotify/config')
      if (!response.ok) {
        throw new Error('Failed to load Spotify configuration')
      }

      const config = await response.json()

      if (!config.clientId) {
        throw new Error("SPOTIFY_CLIENT_ID environment variable is not set")
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize Spotify auth")
      setInitializingSpotify(false)
    }
  }

  const handleGuestPlay = () => {
    router.push("/playlist")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#091009] text-[#dce5d9] flex items-center justify-center font-sans">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#4be277] animate-spin mx-auto mb-4" />
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-white mb-2">
            <span className="text-[#4be277]">Songless</span><span className="text-white font-light">Unlimited</span>
          </h1>
          <p className="text-[#869585] text-sm">Initializing app...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#091009] text-[#dce5d9] flex flex-col justify-between font-sans relative overflow-hidden select-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>

      {/* Ambient glows */}
      <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#4be277]/5 blur-[135px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[150px] pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full h-16 px-8 border-b border-[#3d4a3d]/30 bg-[#091009]/80 backdrop-blur-md flex items-center justify-between z-20 relative">
        <div className="flex items-center gap-2 text-[#4be277] hover:opacity-90 cursor-pointer transition-opacity" onClick={() => router.push("/")}>
          <svg className="w-5 h-5 text-[#4be277]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span className="font-display font-bold text-lg tracking-tight text-[#4be277]">Songless<span className="text-[#dce5d9] font-normal">Unlimited</span></span>
        </div>

        <div className="flex items-center gap-6 text-[#869585]">
          <button className="hover:text-white transition-colors" title="Leaderboard">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20V10" />
              <path d="M18 20V4" />
              <path d="M6 20v-6" />
            </svg>
          </button>
          <button className="hover:text-white transition-colors" title="Settings">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button className="hover:text-white transition-colors" title="Profile">
            <svg className="w-6 h-6 rounded-full border border-[#3d4a3d]/40 p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Hero & Modes Selection */}
      <main className="flex-1 max-w-5xl mx-auto w-full flex flex-col items-center justify-center px-6 py-12 z-10 relative">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-white mb-4">
            <span className="text-[#4be277]">Songless</span> Unlimited
          </h2>
          <p className="text-[#bccbb9] text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Test your music knowledge. Guess the song from short clips.
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

        {/* Side-by-Side Mode Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-2 animate-slide-up">

          {/* Pro Mode Card */}
          <div className="bg-[#0e150e]/60 backdrop-blur-xl border border-[#4be277]/20 hover:border-[#4be277]/40 rounded-2xl p-8 flex flex-col items-center text-center transition-all duration-300 relative group overflow-hidden shadow-[0_0_30px_rgba(75,226,119,0.02)] hover:shadow-[0_0_40px_rgba(75,226,119,0.06)]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#4be277]/2 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="w-16 h-16 rounded-full bg-[#4be277]/10 flex items-center justify-center border border-[#4be277]/20 mb-6">
              <svg className="w-8 h-8 text-[#4be277]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 9c.5.5.5 1.5 0 2" />
                <path d="M20 7c1 1 1 3 0 4" />
              </svg>
            </div>

            <h3 className="font-display text-2xl font-bold text-white mb-3">Pro Mode</h3>
            <p className="text-[#bccbb9] text-sm leading-relaxed mb-8 flex-1 max-w-[280px]">
              Connect your account for full integration and personalized high-stakes tracking.
            </p>

            <Button
              onClick={handleSpotifyLogin}
              disabled={initializingSpotify}
              className="w-full h-12 bg-[#4be277] hover:bg-[#4be277]/90 text-[#003915] font-bold rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(75,226,119,0.25)] transition-all duration-300 active:scale-[0.98]"
            >
              {initializingSpotify ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Connect Spotify Premium"
              )}
            </Button>
          </div>

          {/* Guest Mode Card */}
          <div className="bg-[#0e150e]/40 backdrop-blur-xl border border-white/5 hover:border-white/10 rounded-2xl p-8 flex flex-col items-center text-center transition-all duration-300 relative group overflow-hidden shadow-2xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/1 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                <svg className="w-4 h-4 text-red-500 fill-red-500 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>

            <h3 className="font-display text-2xl font-bold text-white mb-3">Guest Mode</h3>
            <p className="text-[#bccbb9] text-sm leading-relaxed mb-8 flex-1 max-w-[280px]">
              Jump straight in with YouTube or public Spotify playlists. Quick, intense, anonymous.
            </p>

            <Button
              onClick={handleGuestPlay}
              className="w-full h-12 bg-[#1a221a]/60 hover:bg-[#242c24] border border-[#3d4a3d]/50 text-white font-semibold rounded-xl transition-all duration-300 active:scale-[0.98]"
            >
              Play Guest
            </Button>
          </div>

        </div>
      </main>

      {/* Footer Bar */}
      <footer className="w-full py-8 px-8 border-t border-[#3d4a3d]/20 bg-[#091009] flex flex-col md:flex-row justify-between items-center gap-6 z-10 relative">
        <div className="text-center md:text-left">
          <h4 className="font-display text-sm font-bold text-[#dce5d9] mb-1 tracking-wide uppercase">SonglessUnlimited</h4>
          <p className="text-[#869585] text-xs">© 2024 SonglessUnlimited. High-Stakes Music Discovery.</p>
          <p className="text-[#869585] text-[11px] mt-1 leading-relaxed">No Spotify account required for YouTube or public Spotify playlists.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs text-[#bccbb9]">
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Contact Support</a>
          <a href="#" className="hover:text-white transition-colors">How to Play</a>
        </div>
      </footer>

    </div>
  )
}
