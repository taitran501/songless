"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useTracks } from "@/hooks/tracks-store"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"
import { Shuffle, Play, Info, Music, Smartphone, ShieldAlert, Loader2 } from "lucide-react"

interface Track {
  uri: string
  name: string
  duration_ms: number
  albumImage?: string | null
  preview_url?: string | null
}

export default function PlaylistPage() {
  const [playlistInput, setPlaylistInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shuffleEnabled, setShuffleEnabled] = useState(false)
  const [recentPlaylists, setRecentPlaylists] = useState<{ id: string; name: string }[]>([])
  const router = useRouter()
  const { tracks, setTracks } = useTracks()
  const { logout } = useSpotifyAuth()

  // Load recent playlists on mount
  useEffect(() => {
    const saved = localStorage.getItem("recent_playlists")
    if (saved) {
      try {
        setRecentPlaylists(JSON.parse(saved))
      } catch (e) {
        console.error("Error parsing recent playlists:", e)
      }
    }
  }, [])

  useEffect(() => {
    const accessToken = localStorage.getItem("spotify_access_token")
    if (!accessToken) {
      router.push("/")
      return
    }

    // Check if token has streaming scope by testing Web Playback SDK
    const testStreamingAccess = async () => {
      try {
        const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
        
        if (!response.ok) {
          // Token is invalid or missing required scopes, clear and re-login
          logout()
          setError("Your Spotify session is invalid or missing playback permissions. Please log in again.")
          router.push("/")
          return
        }
      } catch (error) {
        console.error("Error checking token scopes:", error)
        logout()
        setError("Could not verify your Spotify session. Please log in again.")
        router.push("/")
      }
    }

    testStreamingAccess()
  }, [logout, router])

  const extractPlaylistId = (input: string) => {
    // Extract playlist ID from URL or return as-is if it's already an ID
    const match = input.match(/playlist\/([a-zA-Z0-9]+)/)
    return match ? match[1] : input
  }

  const loadPlaylistById = async (playlistId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const accessToken = localStorage.getItem("spotify_access_token")
      
      if (!accessToken) {
        setError("No access token found. Please login again.")
        router.push("/")
        return
      }

      const response = await fetch(`/api/spotify/playlist?playlistId=${playlistId}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      })
      
      if (response.status === 401) {
        logout()
        setError("Your Spotify session expired. Please log in again.")
        router.push("/")
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch playlist")
      }
      
      const data = await response.json()

      if (data.length === 0) {
        setError("No playable tracks were found in this playlist. Try another Spotify playlist with available tracks.")
        return
      }

      // Save tracks to global store
      setTracks(data)
      localStorage.setItem("current_playlist_id", playlistId)

      // Fetch playlist metadata to get proper name
      let playlistName = `Playlist #${playlistId}`
      try {
        const metaResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
        if (metaResponse.ok) {
          const metaData = await metaResponse.json()
          playlistName = metaData.name
        }
      } catch (e) {
        console.error("Error fetching playlist metadata:", e)
      }

      // Save to recent playlists in localStorage
      const saved = localStorage.getItem("recent_playlists")
      let recent = saved ? JSON.parse(saved) : []
      recent = recent.filter((p: any) => p.id !== playlistId)
      recent.unshift({ id: playlistId, name: playlistName })
      recent = recent.slice(0, 6) // Keep last 6
      localStorage.setItem("recent_playlists", JSON.stringify(recent))
      setRecentPlaylists(recent)
      
    } catch (error) {
      console.error("Error fetching playlist:", error)
      setError(error instanceof Error ? error.message : "Error fetching playlist")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playlistInput.trim()) return
    const playlistId = extractPlaylistId(playlistInput)
    await loadPlaylistById(playlistId)
  }

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col relative overflow-hidden font-sans p-4 sm:p-6 md:p-8">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-center py-6 sm:py-12">
        <header className="text-center mb-10 animate-fade-in">

          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-green-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent mb-3 drop-shadow-[0_0_30px_rgba(34,197,94,0.15)]">
            Songless<span className="text-white font-light">Unlimited</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
            Test your musical memory. Load any Spotify playlist, listen to the clip, and name the tune.
          </p>
        </header>

        <Card className="bg-gray-900/40 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden mb-6 animate-slide-up">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-white text-lg font-bold flex items-center space-x-2.5">
              <div className="bg-green-500/10 p-2 rounded-lg border border-green-500/20">
                <Music className="w-5 h-5 text-green-400" />
              </div>
              <span>Connect Playlist</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playlist-input" className="text-gray-300 text-sm font-medium">Spotify Playlist URL or ID</Label>
                <Input
                  id="playlist-input"
                  type="text"
                  placeholder="https://open.spotify.com/playlist/..."
                  value={playlistInput}
                  onChange={(e) => setPlaylistInput(e.target.value)}
                  className="bg-gray-950/60 border-white/10 text-white rounded-xl h-12 px-4 focus-visible:ring-green-500/50 focus-visible:border-green-500/50 placeholder-gray-600 transition-all"
                  disabled={loading}
                />
              </div>
              
              {error && (
                <div className="text-red-400 text-sm bg-red-950/20 border border-red-500/30 p-4 rounded-xl flex items-start space-x-2">
                  <span className="font-semibold">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  disabled={loading || !playlistInput.trim()}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold h-12 rounded-xl shadow-lg shadow-green-500/10 hover:shadow-green-500/20 transition-all duration-300 active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Fetching tracks...</span>
                    </span>
                  ) : (
                    "Load Playlist"
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem("spotify_access_token")
                    localStorage.removeItem("spotify_refresh_token")
                    router.push("/")
                  }}
                  className="bg-transparent border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white h-12 rounded-xl font-medium transition-all active:scale-[0.98]"
                >
                  Switch Spotify Account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {recentPlaylists.length > 0 && (
          <Card className="bg-gray-900/40 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden mb-6 animate-slide-up">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-white text-lg font-bold">Recent Playlists</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentPlaylists.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    onClick={() => {
                      setPlaylistInput(p.id)
                      void loadPlaylistById(p.id)
                    }}
                    className="justify-start text-left bg-gray-950/40 hover:bg-gray-900/60 text-white border-white/5 hover:border-white/20 transition-all duration-300 rounded-xl py-6 px-4 h-auto w-full group relative overflow-hidden"
                    disabled={loading}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="truncate w-full relative z-10">
                      <p className="font-bold truncate text-sm text-gray-200 group-hover:text-green-400 transition-colors">{p.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-1">ID: {p.id}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tracks.length > 0 && (
          <div className="mb-6 animate-fade-in">
            <div className="bg-gradient-to-br from-green-950/20 to-emerald-950/10 border border-green-500/30 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-green-500/20 p-2 rounded-xl border border-green-500/30">
                  <span className="text-green-400 font-bold text-sm">✓</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Playlist Loaded</h3>
                  <p className="text-green-400 text-sm">
                    Found {tracks.length} valid tracks in this playlist
                  </p>
                </div>
              </div>
              
              {/* Shuffle Option */}
              <div className="flex items-center justify-between p-4 bg-gray-950/50 rounded-xl border border-white/5 mb-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-500/10 p-2 rounded-lg">
                    <Shuffle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <Label htmlFor="shuffle" className="text-white font-semibold text-sm cursor-pointer">
                      Shuffle Tracks
                    </Label>
                    <p className="text-gray-400 text-xs">
                      Randomize track order before starting the game
                    </p>
                  </div>
                </div>
                <Switch
                  id="shuffle"
                  checked={shuffleEnabled}
                  onCheckedChange={setShuffleEnabled}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>

              <Button 
                onClick={() => {
                  if (shuffleEnabled) {
                    const shuffledTracks = [...tracks].sort(() => Math.random() - 0.5)
                    setTracks(shuffledTracks)
                  }
                  router.push("/game")
                }}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-base h-14 w-full rounded-xl shadow-lg shadow-green-500/20 hover:shadow-green-500/35 transition-all duration-300 active:scale-[0.98]"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2 fill-white" />
                Start Game
              </Button>
            </div>
          </div>
        )}

        {/* Setup & Instructions Guide */}
        <Card className="bg-gray-950/20 backdrop-blur-xl border border-white/5 shadow-2xl rounded-2xl overflow-hidden animate-slide-up">
          <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/5 to-transparent p-4 border-b border-white/5">
            <div className="flex items-center space-x-2">
              <Info className="w-5 h-5 text-green-400" />
              <h2 className="text-white font-semibold text-base">Setup & Guide</h2>
            </div>
          </div>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-gray-900/30 p-4 rounded-xl border border-white/5 space-y-2 hover:border-white/10 transition-colors">
                <div className="flex items-center space-x-2 text-green-400">
                  <Music className="w-4 h-4" />
                  <span className="font-semibold text-[10px] uppercase tracking-wider">Spotify Account</span>
                </div>
                <h3 className="text-white font-semibold text-sm">Account Requirements</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Spotify Premium is optional. If your songs don't have previews, the game will automatically utilize the Web SDK.
                </p>
              </div>

              <div className="bg-gray-900/30 p-4 rounded-xl border border-white/5 space-y-2 hover:border-white/10 transition-colors">
                <div className="flex items-center space-x-2 text-green-400">
                  <Smartphone className="w-4 h-4" />
                  <span className="font-semibold text-[10px] uppercase tracking-wider">Active Device</span>
                </div>
                <h3 className="text-white font-semibold text-sm">SDK Player Link</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Keep Spotify desktop or mobile player active. Play any track for 2s first to establish connection if using Premium.
                </p>
              </div>
            </div>

            <div className="bg-amber-950/15 border border-amber-500/20 rounded-xl p-4 flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-amber-400 font-semibold text-xs uppercase tracking-wide">Troubleshooting 403 Errors</h4>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  If the SDK device transfer fails, open the Spotify App, press play on any track, then pause, and click Play in game.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
