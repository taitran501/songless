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
import { Shuffle, Play } from "lucide-react"

interface Track {
  uri: string
  name: string
  duration_ms: number
  albumImage?: string | null
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
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white text-center mb-8">SonglessUnlimited</h1>

        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Add Playlist</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="Enter Spotify playlist ID or URL"
                value={playlistInput}
                onChange={(e) => setPlaylistInput(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white"
                disabled={loading}
              />
              
              {error && (
                <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded">
                  {error}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={loading || !playlistInput.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? "Loading..." : "Load Playlist"}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem("spotify_access_token")
                    localStorage.removeItem("spotify_refresh_token")
                    router.push("/")
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Re-login with new scopes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {recentPlaylists.length > 0 && (
          <Card className="bg-gray-900 border-gray-700 mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Recent Playlists</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentPlaylists.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    onClick={() => {
                      setPlaylistInput(p.id)
                      void loadPlaylistById(p.id)
                    }}
                    className="justify-start text-left bg-gray-800 hover:bg-gray-700 text-white border-gray-600 truncate py-6 h-auto w-full"
                    disabled={loading}
                  >
                    <div className="truncate w-full">
                      <p className="font-semibold truncate text-sm">{p.name}</p>
                      <p className="text-xs text-gray-400 truncate">ID: {p.id}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tracks.length > 0 && (
          <div className="mt-6">
            <div className="bg-green-900/20 border border-green-600 rounded-lg p-6 mb-4">
              <h3 className="text-green-400 text-lg font-semibold mb-4">✅ Playlist Loaded Successfully!</h3>
              <p className="text-green-200 mb-6">
                Found {tracks.length} tracks in your playlist.
              </p>
              
              {/* Shuffle Option */}
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-600 mb-6">
                <div className="flex items-center space-x-3">
                  <Shuffle className="w-5 h-5 text-green-400" />
                  <div>
                    <Label htmlFor="shuffle" className="text-white font-medium">
                      Shuffle Tracks
                    </Label>
                    <p className="text-gray-400 text-sm">
                      Randomize the order of tracks before starting the game
                    </p>
                  </div>
                </div>
                <Switch
                  id="shuffle"
                  checked={shuffleEnabled}
                  onCheckedChange={setShuffleEnabled}
                />
              </div>

              {/* Game Rules */}
              <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4 mb-6">
                <h3 className="text-blue-400 text-lg font-semibold mb-2">Game Rules</h3>
                <ul className="text-blue-200 text-sm space-y-1">
                  <li>• You'll hear the beginning of each song through Spotify playback</li>
                  <li>• Try to guess the song title</li>
                  <li>• Each song has 6 stages with increasing preview duration</li>
                  <li>• You can pause, resume, skip stages, or submit a guess at any time</li>
                  <li>• Stage 1: 0.5s • Stage 2: 1s • Stage 3: 2s • Stage 4: 4s • Stage 5: 8s • Stage 6: 15s</li>
                </ul>
              </div>

              <Button 
                onClick={() => {
                  if (shuffleEnabled) {
                    // Shuffle tracks before starting game
                    const shuffledTracks = [...tracks].sort(() => Math.random() - 0.5)
                    setTracks(shuffledTracks)
                  }
                  router.push("/game")
                }}
                className="bg-green-600 hover:bg-green-700 w-full"
                size="lg"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Game
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
