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
import { DAILY_DATE_STORAGE_KEY, GAME_MODE_STORAGE_KEY } from "@/lib/curated-tracks"
import type { GameTrack } from "@/lib/tracks"
import { isYouTubePlaylistInput } from "@/lib/youtube"
import { Shuffle, Play, Info, Music, Smartphone, ShieldAlert, Loader2, Youtube, RotateCw, Trash2 } from "lucide-react"

export default function PlaylistPage() {
  const [playlistInput, setPlaylistInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null)
  const [loadingPlaylistName, setLoadingPlaylistName] = useState<string | null>(null)
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shuffleEnabled, setShuffleEnabled] = useState(false)
  const [trackCount, setTrackCount] = useState<string>("20")
  const [recentPlaylists, setRecentPlaylists] = useState<{ 
    id: string; 
    name: string; 
    trackCount?: number; 
    source?: "spotify" | "youtube";
  }[]>([])
  const router = useRouter()
  const { tracks, setTracks } = useTracks()
  const { accessToken, logout } = useSpotifyAuth()
  const hasSpotifyConnection = Boolean(accessToken)

  // Load recent playlists on mount and restore active playlist
  useEffect(() => {
    const saved = localStorage.getItem("recent_playlists")
    if (saved) {
      try {
        setRecentPlaylists(JSON.parse(saved))
      } catch (e) {
        console.error("Error parsing recent playlists:", e)
      }
    }
    // Restore the currently active playlist ID
    const currentId = localStorage.getItem("current_playlist_id")
    if (currentId) setActivePlaylistId(currentId)
  }, [])

  useEffect(() => {
    if (!accessToken) {
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
          // Token is invalid or missing required scopes, clear and let them be a guest
          logout()
          setError("Your Spotify session expired. Spotify features are locked, but you can still play YouTube playlists.")
          return
        }
      } catch (error) {
        console.error("Error checking token scopes:", error)
        logout()
        setError("Could not verify Spotify session. Running in guest mode.")
      }
    }

    testStreamingAccess()
  }, [accessToken, logout])

  const extractPlaylistId = (input: string) => {
    // Extract playlist ID from URL or return as-is if it's already an ID
    const match = input.match(/playlist\/([a-zA-Z0-9]+)/)
    return match ? match[1] : input
  }

  const loadPlaylistById = async (playlistId: string) => {
    setLoading(true)
    setLoadingPlaylistId(playlistId)
    setError(null)

    // Try to use an existing name from recent playlists as a hint while loading
    const knownName = recentPlaylists.find((p) => p.id === playlistId)?.name ?? null
    setLoadingPlaylistName(knownName)
    
    try {
      const isYT = isYouTubePlaylistInput(playlistId)
      let data: GameTrack[] = []
      let playlistName = `Playlist #${playlistId}`

      if (isYT) {
        const response = await fetch(`/api/youtube/playlist?url=${encodeURIComponent(playlistId)}`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to fetch YouTube playlist")
        }

        data = await response.json()
        const nameHeader = response.headers.get("x-playlist-name")
        if (nameHeader) {
          playlistName = decodeURIComponent(nameHeader)
        }
      } else {
        const accessToken = localStorage.getItem("spotify_access_token")
        const response = await fetch(
          `/api/spotify/playlist?playlistId=${playlistId}`,
          accessToken
            ? {
                headers: {
                  "Authorization": `Bearer ${accessToken}`
                }
              }
            : undefined
        )

        if (response.status === 401 && accessToken) {
          logout()
          setError("Your Spotify session expired. Please log in again.")
          router.push("/")
          return
        }

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to fetch playlist")
        }

        data = await response.json()
        const nameHeader = response.headers.get("x-playlist-name")
        if (nameHeader) {
          playlistName = decodeURIComponent(nameHeader)
        }
      }

      if (data.length === 0) {
        setError("No playable tracks were found in this playlist. Try another playlist with available tracks.")
        return
      }

      // Save tracks to global store
      setTracks(data)
      localStorage.setItem("full_playlist_tracks", JSON.stringify(data))
      localStorage.setItem("current_playlist_id", playlistId)

      // Save to recent playlists in localStorage
      const saved = localStorage.getItem("recent_playlists")
      let recent = saved ? JSON.parse(saved) : []
      recent = recent.filter((p: any) => p.id !== playlistId)
      recent.unshift({ 
        id: playlistId, 
        name: playlistName,
        trackCount: data.length,
        source: isYouTubePlaylistInput(playlistId) ? "youtube" : "spotify"
      })
      recent = recent.slice(0, 6) // Keep last 6
      localStorage.setItem("recent_playlists", JSON.stringify(recent))
      setRecentPlaylists(recent)
      setActivePlaylistId(playlistId)
      
    } catch (error) {
      console.error("Error fetching playlist:", error)
      setError(error instanceof Error ? error.message : "Error fetching playlist")
    } finally {
      setLoading(false)
      setLoadingPlaylistId(null)
      setLoadingPlaylistName(null)
    }
  }

  const handleDeleteRecentPlaylist = (playlistId: string) => {
    const saved = localStorage.getItem("recent_playlists")
    if (saved) {
      try {
        let recent = JSON.parse(saved)
        if (Array.isArray(recent)) {
          recent = recent.filter((p: any) => p.id !== playlistId)
          localStorage.setItem("recent_playlists", JSON.stringify(recent))
          setRecentPlaylists(recent)
        }
      } catch (err) {
        console.error("Error deleting recent playlist:", err)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playlistInput.trim()) return
    const playlistId = extractPlaylistId(playlistInput)
    await loadPlaylistById(playlistId)
  }

  return (
    <div className="min-h-screen bg-[#020617] text-[#dce5d9] flex flex-col relative overflow-hidden font-sans p-4 sm:p-6 md:p-8 select-none">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#10b981]/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-center py-6 sm:py-12">
        <header className="text-center mb-10 animate-fade-in">

          <h1 className="font-display text-5xl font-extrabold tracking-tight bg-gradient-to-r from-[#10b981] via-emerald-400 to-[#10b981] bg-clip-text text-transparent mb-3 drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            Songless<span className="text-white font-light">Unlimited</span>
          </h1>
          <p className="text-[#9ca3af] text-sm max-w-md mx-auto leading-relaxed">
            {hasSpotifyConnection
              ? "Load a Spotify or YouTube playlist, listen to the clip, and name the tune."
              : "Guest mode is active. Load a YouTube or public Spotify playlist without signing in."}
          </p>
        </header>

        <Card className="bg-[#090d16]/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden mb-6 animate-slide-up ring-1 ring-white/5">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-white text-lg font-bold flex items-center space-x-2.5">
              <div className="bg-[#10b981]/10 p-2 rounded-lg border border-[#10b981]/20">
                <Music className="w-5 h-5 text-[#10b981]" />
              </div>
              <span className="font-display tracking-wide">CONNECT PLAYLIST</span>
              {!hasSpotifyConnection && (
                <span className="ml-auto font-display text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1 tracking-wider uppercase font-semibold">
                  Guest
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playlist-input" className="text-gray-300 text-sm font-medium">
                  {hasSpotifyConnection ? "Spotify or YouTube Playlist URL or ID" : "YouTube or public Spotify Playlist URL or ID"}
                </Label>
                <Input
                  id="playlist-input"
                  type="text"
                  placeholder="https://open.spotify.com/playlist/... or https://www.youtube.com/playlist?list=..."
                  value={playlistInput}
                  onChange={(e) => setPlaylistInput(e.target.value)}
                  className="bg-[#030712] border-white/10 text-white rounded-xl h-12 px-4 focus-visible:ring-[#10b981]/50 focus-visible:border-[#10b981]/50 placeholder-gray-600 transition-all"
                  disabled={loading}
                />
              </div>
              
              {error && (
                <div className="text-red-400 text-sm bg-red-950/20 border border-red-500/30 p-4 rounded-xl flex items-start space-x-2">
                  <span className="font-semibold">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              
              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={loading || !playlistInput.trim()}
                  className="w-full bg-[#10b981] hover:bg-[#10b981]/90 text-black font-bold h-12 rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="truncate max-w-[240px]">
                        {loadingPlaylistName ? `Loading "${loadingPlaylistName}"...` : "Fetching tracks..."}
                      </span>
                    </span>
                  ) : (
                    "LOAD PLAYLIST"
                  )}
                </Button>

                {hasSpotifyConnection ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        logout()
                        setError(null)
                      }}
                      className="bg-transparent border border-red-500/20 hover:bg-red-500/10 text-gray-300 hover:text-white h-12 rounded-xl font-medium transition-all active:scale-[0.98]"
                    >
                      <Youtube className="w-4 h-4 mr-2 text-red-400" />
                      Use Guest Mode
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        logout()
                        router.push("/")
                      }}
                      className="bg-transparent border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white h-12 rounded-xl font-medium transition-all active:scale-[0.98]"
                    >
                      Switch Spotify Account
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/")}
                    className="bg-transparent border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white h-12 rounded-xl font-medium transition-all active:scale-[0.98]"
                  >
                    Connect Spotify
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {recentPlaylists.length > 0 && (
          <Card className="bg-[#090d16]/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden mb-6 animate-slide-up ring-1 ring-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-white text-lg font-bold font-display">RECENT PLAYLISTS</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentPlaylists.map((p) => {
                  const inferredSource = p.source || (isYouTubePlaylistInput(p.id) ? "youtube" : "spotify")
                  const isActive = activePlaylistId === p.id
                  const isThisLoading = loadingPlaylistId === p.id
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between text-white transition-all duration-300 rounded-xl p-4 w-full group relative overflow-hidden border ${
                        isActive
                          ? "bg-[#10b981]/8 border-[#10b981]/40 ring-1 ring-[#10b981]/20"
                          : "bg-[#030712]/60 hover:bg-[#030712]/90 border-white/5 hover:border-[#10b981]/30"
                      }`}
                    >
                      <div className={`pointer-events-none absolute inset-0 transition-opacity ${
                        isActive
                          ? "bg-gradient-to-r from-[#10b981]/5 via-[#10b981]/8 to-[#10b981]/5 opacity-100"
                          : "bg-gradient-to-r from-[#10b981]/0 via-[#10b981]/5 to-[#10b981]/0 opacity-0 group-hover:opacity-100"
                      }`}></div>
                      
                      {/* Left: Clickable Playlist Info */}
                      <button
                        type="button"
                        onClick={() => {
                          setPlaylistInput(p.id)
                          void loadPlaylistById(p.id)
                        }}
                        className="flex items-center space-x-3 flex-1 text-left min-w-0 disabled:opacity-50"
                        disabled={loading}
                      >
                        <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                          isThisLoading
                            ? "bg-white/10 text-white animate-pulse"
                            : inferredSource === "youtube"
                              ? "bg-red-500/10 text-red-400 group-hover:bg-red-500/20"
                              : "bg-[#10b981]/10 text-[#10b981] group-hover:bg-[#10b981]/20"
                        }`}>
                          {isThisLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : inferredSource === "youtube" ? (
                            <Youtube className="w-5 h-5" />
                          ) : (
                            <Music className="w-5 h-5" />
                          )}
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-bold truncate text-sm transition-colors ${
                              isActive ? "text-[#10b981]" : "text-gray-200 group-hover:text-[#10b981]"
                            }`}>{p.name}</p>
                            {isActive && !isThisLoading && (
                              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981] font-bold uppercase tracking-wider border border-[#10b981]/30">
                                Selected
                              </span>
                            )}
                            {isThisLoading && (
                              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300 font-bold uppercase tracking-wider animate-pulse">
                                Loading...
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1 flex-wrap gap-y-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-medium">
                              {p.trackCount !== undefined ? `${p.trackCount} ${p.trackCount === 1 ? "song" : "songs"}` : "Unknown count"}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide uppercase ${
                              inferredSource === "youtube"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-[#10b981]/10 text-[#10b981]"
                            }`}>
                              {inferredSource === "youtube" ? "YouTube" : "Spotify"}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Right: Actions */}
                      <div className="flex items-center space-x-1.5 ml-2 relative z-20 shrink-0">
                        {/* Refresh Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            void loadPlaylistById(p.id)
                          }}
                          disabled={loading}
                          className="h-8 w-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
                          title="Refresh Playlist"
                        >
                          <RotateCw className="w-4 h-4" />
                        </Button>
                        
                        {/* Delete Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteRecentPlaylist(p.id)
                          }}
                          className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
                          title="Remove Playlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {tracks.length > 0 && (
          <div className="mb-6 animate-fade-in">
            <div className="bg-gradient-to-br from-[#10b981]/10 to-indigo-500/5 border border-[#10b981]/30 rounded-2xl p-6 shadow-2xl ring-1 ring-[#10b981]/20">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-[#10b981]/20 p-2 rounded-xl border border-[#10b981]/30">
                  <span className="text-[#10b981] font-bold text-sm">✓</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg font-display">PLAYLIST LOADED</h3>
                  <p className="text-[#10b981] text-sm">
                    Found {tracks.length} valid tracks in this playlist
                  </p>
                </div>
              </div>
              
              {/* Track Count Option */}
              <div className="flex flex-col gap-3 p-4 bg-[#030712]/60 rounded-xl border border-white/5 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-[#10b981]/10 p-2 rounded-lg">
                    <Music className="w-5 h-5 text-[#10b981]" />
                  </div>
                  <div>
                    <Label className="text-white font-semibold text-sm">
                      Number of Tracks
                    </Label>
                    <p className="text-gray-400 text-xs">
                      Choose how many tracks to include in this round
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-1">
                  {["5", "10", "20", "50", "all"].map((val) => {
                    const isSelected = trackCount === val
                    const numVal = parseInt(val)
                    const isDisabled = val !== "all" && tracks.length < numVal

                    return (
                      <Button
                        key={val}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => setTrackCount(val)}
                        disabled={isDisabled}
                        className={`flex-1 min-w-[60px] h-10 text-xs font-semibold uppercase tracking-wider transition-all duration-300 rounded-lg active:scale-95 ${
                          isSelected
                            ? "bg-[#10b981] hover:bg-[#10b981]/90 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            : "bg-transparent hover:bg-white/5 text-gray-300 hover:text-white border-white/10"
                        }`}
                      >
                        {val === "all" ? "All" : val}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Shuffle Option */}
              <div className="flex items-center justify-between p-4 bg-[#030712]/60 rounded-xl border border-white/5 mb-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-[#10b981]/10 p-2 rounded-lg">
                    <Shuffle className="w-5 h-5 text-[#10b981]" />
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
                  className="data-[state=checked]:bg-[#10b981]"
                />
              </div>

              <Button 
                onClick={() => {
                  const savedFull = localStorage.getItem("full_playlist_tracks")
                  let sourceTracks = tracks
                  if (savedFull) {
                    try {
                      const parsed = JSON.parse(savedFull)
                      if (Array.isArray(parsed) && parsed.length > 0) {
                        sourceTracks = parsed
                      }
                    } catch {}
                  }

                  let processedTracks = [...sourceTracks]

                  // 1. Shuffle first if enabled
                  if (shuffleEnabled) {
                    processedTracks = processedTracks.sort(() => Math.random() - 0.5)
                  }

                  // 2. Slice to chosen track count
                  if (trackCount !== "all") {
                    const limit = parseInt(trackCount)
                    if (!isNaN(limit)) {
                      processedTracks = processedTracks.slice(0, limit)
                    }
                  }

                  // 3. Clear existing game states to avoid starting with a pre-existing state
                  localStorage.removeItem("game_state")
                  
                  // 4. Save processed tracks to store & redirect
                  setTracks(processedTracks)
                  localStorage.setItem(GAME_MODE_STORAGE_KEY, "audio")
                  localStorage.removeItem(DAILY_DATE_STORAGE_KEY)
                  router.push("/game")
                }}
                className="bg-[#10b981] hover:bg-[#10b981]/90 text-black font-bold text-base h-14 w-full rounded-xl shadow-lg hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2 fill-black text-black" />
                START GAME
              </Button>
            </div>
          </div>
        )}

        {/* Setup & Instructions Guide */}
        <Card className="bg-[#090d16]/30 backdrop-blur-xl border border-white/5 shadow-2xl rounded-2xl overflow-hidden animate-slide-up ring-1 ring-white/5">
          <div className="bg-gradient-to-r from-[#10b981]/10 via-[#10b981]/5 to-transparent p-4 border-b border-white/5">
            <div className="flex items-center space-x-2">
              <Info className="w-5 h-5 text-[#10b981]" />
              <h2 className="text-white font-semibold text-base font-display">SETUP & GUIDE</h2>
            </div>
          </div>
          <CardContent className="p-6 space-y-4">
            {hasSpotifyConnection ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="bg-[#030712]/30 p-4 rounded-xl border border-white/5 space-y-2 hover:border-[#10b981]/20 transition-colors">
                    <div className="flex items-center space-x-2 text-[#10b981]">
                      <Music className="w-4 h-4" />
                      <span className="font-display font-semibold text-[10px] uppercase tracking-wider">Spotify Account</span>
                    </div>
                    <h3 className="text-white font-semibold text-sm">Spotify Playback</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Public Spotify playlists also work in guest mode. Login is still needed for private playlists and Spotify playback.
                    </p>
                  </div>

                  <div className="bg-[#030712]/30 p-4 rounded-xl border border-white/5 space-y-2 hover:border-[#10b981]/20 transition-colors">
                    <div className="flex items-center space-x-2 text-[#10b981]">
                      <Smartphone className="w-4 h-4" />
                      <span className="font-display font-semibold text-[10px] uppercase tracking-wider">Active Device</span>
                    </div>
                    <h3 className="text-white font-semibold text-sm">SDK Player Link</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Keep Spotify desktop or mobile active if you use Spotify playback.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-950/15 border border-amber-500/20 rounded-xl p-4 flex items-start space-x-3">
                  <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-amber-400 font-semibold text-xs uppercase tracking-wide">Troubleshooting 403 Errors</h4>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      If Spotify device transfer fails, open Spotify, play any track briefly, then return to the game.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#030712]/30 p-4 rounded-xl border border-[#10b981]/20 space-y-2">
                <div className="flex items-center space-x-2 text-red-400">
                  <Music className="w-4 h-4" />
                  <span className="font-semibold text-[10px] uppercase tracking-wider">Guest Mode</span>
                </div>
                <h3 className="text-white font-semibold text-sm">YouTube and public Spotify playlists</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Paste a YouTube playlist or public Spotify playlist URL. Private Spotify playlists still need a Spotify login.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
