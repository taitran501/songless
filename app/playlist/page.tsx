"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useTracks } from "@/hooks/tracks-store"
import {
  captureProductEvent,
  getRunAnalyticsContext,
} from "@/lib/analytics"
import { createGameSession, readGameSession, writeGameSession } from "@/lib/game-session"
import {
  discardResumableGameSession,
  readResumableGameSession,
} from "@/lib/resumable-session"
import { normalizeTracks, type GameTrack } from "@/lib/tracks"
import { extractYouTubePlaylistId, isYouTubePlaylistInput } from "@/lib/youtube"
import { fetchWithTimeout } from "@/lib/request-timeout"
import { ArrowLeft, Shuffle, Play, Info, Music, Loader2, Youtube, RotateCw, Trash2 } from "lucide-react"

export default function PlaylistPage() {
  const [playlistInput, setPlaylistInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null)
  const [loadingPlaylistName, setLoadingPlaylistName] = useState<string | null>(null)
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const [loadedPlaylistName, setLoadedPlaylistName] = useState<string | null>(null)
  const [loadedPlaylistSource, setLoadedPlaylistSource] = useState<"spotify" | "youtube" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shuffleEnabled, setShuffleEnabled] = useState(false)
  const [trackCount, setTrackCount] = useState<string>("20")
  const [recentPlaylists, setRecentPlaylists] = useState<{ 
    id: string; 
    name: string; 
    trackCount?: number; 
    source?: "spotify" | "youtube";
  }[]>([])
  const loadRequestIdRef = useRef(0)
  const loadAbortControllerRef = useRef<AbortController | null>(null)
  const router = useRouter()
  const { tracks, setTracks } = useTracks()
  const modeLabel = "Guest Playlist Mode"

  // Load recent playlists on mount and restore active playlist
  useEffect(() => {
    const saved = localStorage.getItem("recent_playlists")
    let parsedRecent: typeof recentPlaylists = []
    if (saved) {
      try {
        const candidate = JSON.parse(saved)
        if (Array.isArray(candidate)) {
          parsedRecent = candidate
            .filter((playlist): playlist is typeof recentPlaylists[number] =>
              Boolean(playlist && typeof playlist.id === "string" && typeof playlist.name === "string")
            )
            .slice(0, 6)
          setRecentPlaylists(parsedRecent)
        }
      } catch (e) {
        console.error("Error parsing recent playlists:", e)
      }
    }
    const currentSession = readGameSession(localStorage)
    const currentId = currentSession?.kind === "playlist" ? currentSession.id : null
    if (currentId) {
      setActivePlaylistId(currentId)
      const currentRecent = parsedRecent.find((playlist) => playlist.id === currentId)
      if (currentRecent) {
        setLoadedPlaylistName(currentRecent.name)
        setLoadedPlaylistSource(currentRecent.source ?? (isYouTubePlaylistInput(currentId) ? "youtube" : "spotify"))
      }
    }

    return () => {
      loadAbortControllerRef.current?.abort()
    }
  }, [])

  const clearLoadedPlaylist = () => {
    setTracks([])
    localStorage.removeItem("full_playlist_tracks")
    setActivePlaylistId(null)
    setLoadedPlaylistName(null)
    setLoadedPlaylistSource(null)
  }

  const parsePlaylistInput = (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) return null

    const isYouTube = isYouTubePlaylistInput(trimmed)
    if (isYouTube) {
      return extractYouTubePlaylistId(trimmed)
        ? { provider: "youtube" as const, value: trimmed }
        : null
    }

    try {
      const url = new URL(trimmed)
      if (url.hostname !== "spotify.com" && !url.hostname.endsWith(".spotify.com")) return null
      const match = url.pathname.match(/^\/playlist\/([a-zA-Z0-9]{8,128})\/?$/)
      return match ? { provider: "spotify" as const, value: match[1] } : null
    } catch {
      return /^[a-zA-Z0-9]{8,128}$/.test(trimmed)
        ? { provider: "spotify" as const, value: trimmed }
        : null
    }
  }

  const loadPlaylistById = async (input: string) => {
    const parsedInput = parsePlaylistInput(input)
    const requestId = ++loadRequestIdRef.current
    loadAbortControllerRef.current?.abort()

    if (!parsedInput) {
      clearLoadedPlaylist()
      setLoading(false)
      setLoadingPlaylistId(null)
      setLoadingPlaylistName(null)
      loadAbortControllerRef.current = null
      setError("Enter a valid YouTube playlist URL/ID or public Spotify playlist URL/ID.")
      return
    }

    const controller = new AbortController()
    loadAbortControllerRef.current = controller
    clearLoadedPlaylist()
    setLoading(true)
    setLoadingPlaylistId(input)
    setError(null)

    // Try to use an existing name from recent playlists as a hint while loading
    const knownName = recentPlaylists.find((p) => p.id === input)?.name ?? null
    setLoadingPlaylistName(knownName)
    
    try {
      const isYT = parsedInput.provider === "youtube"
      let data: GameTrack[] = []
      let playlistName = `Playlist #${parsedInput.value}`

      if (isYT) {
        const response = await fetchWithTimeout(
          `/api/youtube/playlist?url=${encodeURIComponent(parsedInput.value)}`,
          { signal: controller.signal },
          20_000
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to fetch YouTube playlist")
        }

        const payload = await response.json()
        if (!Array.isArray(payload)) throw new Error("Playlist response was malformed.")
        data = normalizeTracks(payload)
        const nameHeader = response.headers.get("x-playlist-name")
        if (nameHeader) {
          try {
            playlistName = decodeURIComponent(nameHeader)
          } catch {
            // Keep the provider/id fallback when a header is malformed.
          }
        }
      } else {
        const response = await fetchWithTimeout(
          `/api/spotify/playlist?playlistId=${encodeURIComponent(parsedInput.value)}`,
          { signal: controller.signal },
          20_000
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to fetch playlist")
        }

        const payload = await response.json()
        if (!Array.isArray(payload)) throw new Error("Playlist response was malformed.")
        data = normalizeTracks(payload)
        const nameHeader = response.headers.get("x-playlist-name")
        if (nameHeader) {
          try {
            playlistName = decodeURIComponent(nameHeader)
          } catch {
            // Keep the provider/id fallback when a header is malformed.
          }
        }
      }

      if (data.length === 0) {
        setError("No playable tracks were found in this playlist. Try another playlist with available tracks.")
        return
      }

      if (requestId !== loadRequestIdRef.current || controller.signal.aborted) return

      // Save tracks to global store
      setTracks(data)
      localStorage.setItem("full_playlist_tracks", JSON.stringify(data))
      // Save to recent playlists in localStorage
      const saved = localStorage.getItem("recent_playlists")
      let recent: typeof recentPlaylists = []
      if (saved) {
        try {
          const parsedRecent = JSON.parse(saved)
          if (Array.isArray(parsedRecent)) {
            recent = parsedRecent.filter(
              (playlist): playlist is typeof recentPlaylists[number] =>
                Boolean(playlist && typeof playlist.id === "string" && typeof playlist.name === "string")
            )
          }
        } catch {
          // A corrupt recent-playlist list should not invalidate a fresh load.
        }
      }
      recent = recent.filter((p) => p.id !== input)
      recent.unshift({ 
        id: input,
        name: playlistName,
        trackCount: data.length,
        source: isYT ? "youtube" : "spotify"
      })
      recent = recent.slice(0, 6) // Keep last 6
      localStorage.setItem("recent_playlists", JSON.stringify(recent))
      setRecentPlaylists(recent)
      setActivePlaylistId(input)
      setLoadedPlaylistName(playlistName)
      setLoadedPlaylistSource(isYT ? "youtube" : "spotify")
      setTrackCount(data.length >= 5 ? "5" : "all")
      
    } catch (error) {
      if (controller.signal.aborted || requestId !== loadRequestIdRef.current) return
      console.error("Error fetching playlist:", error)
      clearLoadedPlaylist()
      const message = error instanceof Error ? error.message : "Error fetching playlist"
      if (/private|unavailable/i.test(message)) {
        setError("This playlist is private or unavailable. Check the link and try again.")
      } else if (/not found|404/i.test(message)) {
        setError("This playlist could not be found. Check the link and try again.")
      } else if (/network|fetch failed|failed to fetch|timed out|timeout|provider/i.test(message)) {
        setError("Could not reach the playlist provider. Check your connection and try again.")
      } else {
        setError("Could not load this playlist. Check the link and try again.")
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false)
        setLoadingPlaylistId(null)
        setLoadingPlaylistName(null)
        loadAbortControllerRef.current = null
      }
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
    await loadPlaylistById(playlistInput)
  }

  return (
    <div className="min-h-screen bg-[#020617] text-[#dce5d9] flex flex-col relative overflow-hidden font-sans p-4 sm:p-6 md:p-8">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#10b981]/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-center py-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
            className="bg-[#030712]/70 border-white/10 text-[#dce5d9] hover:bg-white/5 hover:text-white h-10 rounded-xl font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Home
          </Button>
          <div className="rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#10b981]">
            Mode: {modeLabel}
          </div>
        </div>

        <header className="text-center mb-10 animate-fade-in">

          <h1 className="font-display text-5xl font-extrabold tracking-tight bg-gradient-to-r from-[#10b981] via-emerald-400 to-[#10b981] bg-clip-text text-transparent mb-3 drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            Songless<span className="text-white font-light">Unlimited</span>
          </h1>
          <p className="text-[#9ca3af] text-sm max-w-md mx-auto leading-relaxed">
            Guest mode is active. Load a YouTube or public Spotify playlist without signing in.
          </p>
        </header>

        <Card className="bg-[#090d16]/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden mb-6 animate-slide-up ring-1 ring-white/5">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-white text-lg font-bold flex items-center space-x-2.5">
              <div className="bg-[#10b981]/10 p-2 rounded-lg border border-[#10b981]/20">
                <Music className="w-5 h-5 text-[#10b981]" />
              </div>
              <span className="font-display tracking-wide">CONNECT PLAYLIST</span>
              <span className="ml-auto font-display text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1 tracking-wider uppercase font-semibold">
                Guest
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playlist-input" className="text-gray-300 text-sm font-medium">
                  YouTube or public Spotify Playlist URL or ID
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
                <div
                  data-testid="playlist-load-error"
                  role="alert"
                  className="text-red-400 text-sm bg-red-950/20 border border-red-500/30 p-4 rounded-xl flex items-start space-x-2"
                >
                  <span className="font-semibold">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              
              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  data-testid="load-playlist"
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
                        className="flex cursor-pointer items-center space-x-3 flex-1 text-left min-w-0 disabled:cursor-not-allowed disabled:opacity-50"
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
            <div
              data-testid="playlist-loaded"
              className="bg-gradient-to-br from-[#10b981]/10 to-indigo-500/5 border border-[#10b981]/30 rounded-2xl p-6 shadow-2xl ring-1 ring-[#10b981]/20"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-[#10b981]/20 p-2 rounded-xl border border-[#10b981]/30">
                  <span className="text-[#10b981] font-bold text-sm">✓</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg font-display">PLAYLIST LOADED</h3>
                  {loadedPlaylistName && (
                    <p data-testid="loaded-playlist-name" className="mt-1 max-w-[32rem] truncate text-sm font-semibold text-white">
                      {loadedPlaylistName}
                    </p>
                  )}
                  {loadedPlaylistSource && (
                    <p data-testid="loaded-playlist-source" className="text-xs uppercase tracking-wider text-[#a8b0bf]">
                      Source: {loadedPlaylistSource === "youtube" ? "YouTube" : "Spotify"}
                    </p>
                  )}
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
                data-testid="start-playlist-game"
                disabled={tracks.length === 0 || loading}
                onClick={() => {
                  const resumable = readResumableGameSession(localStorage)
                  if (
                    resumable &&
                    !window.confirm("Start a new run and discard current progress?")
                  ) {
                    return
                  }
                  if (resumable) {
                    discardResumableGameSession(localStorage, resumable)
                  }

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
                  const playlistId = activePlaylistId || "guest-playlist"
                  const source = isYouTubePlaylistInput(playlistId) ? "youtube" : "spotify"
                  const session = createGameSession({
                    kind: "playlist",
                    playbackMode: "audio",
                    id: playlistId,
                    playlistSource: source,
                  })
                  writeGameSession(localStorage, session)
                  captureProductEvent({
                    name: "run_started",
                    properties: {
                      ...getRunAnalyticsContext(session),
                      totalTracks: processedTracks.length,
                    },
                  })
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
            <div className="bg-[#030712]/30 p-4 rounded-xl border border-[#10b981]/20 space-y-2">
              <div className="flex items-center space-x-2 text-red-400">
                <Music className="w-4 h-4" />
                <span className="font-semibold text-[10px] uppercase tracking-wider">Guest Mode</span>
              </div>
              <h3 className="text-white font-semibold text-sm">YouTube and public Spotify playlists</h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                Paste a YouTube playlist or public Spotify playlist URL to play immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
