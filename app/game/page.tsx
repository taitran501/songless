"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Loader2, X, Music, AlertTriangle, Smartphone, Sparkles, ExternalLink } from "lucide-react"
import { GameModal } from "@/components/game-modal"
import { useTracks } from "@/hooks/tracks-store"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"
import { useToast } from "@/hooks/use-toast"

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void
    Spotify: {
      Player: new (config: {
        name: string
        getOAuthToken: (callback: (token: string) => void) => void | Promise<void>
        volume?: number
      }) => SpotifyPlayer
    }
  }
}

interface SpotifyPlayer {
  addListener: (event: string, callback: (data: any) => void) => void
  connect: () => Promise<boolean>
  disconnect: () => void
  pause: () => Promise<void>
  resume: () => Promise<void>
  getCurrentState: () => Promise<any>
}

export default function GamePage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentStage, setCurrentStage] = useState(0)
  const [guess, setGuess] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null)
  const [deviceId, setDeviceId] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [modalContent, setModalContent] = useState<{ correct: boolean; answer: string }>({ correct: false, answer: "" })
  const [isLoading, setIsLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const router = useRouter()
  const { tracks, isLoading: tracksLoading } = useTracks()
  const { accessToken, ensureValidToken, isLoading: authLoading, logout } = useSpotifyAuth()
  const [isPremium, setIsPremium] = useState(true)
  const [premiumCheckDone, setPremiumCheckDone] = useState(false)

  const { toast } = useToast()
  const [guesses, setGuesses] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedUri, setSelectedUri] = useState<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const stageDurations = [500, 1000, 2000, 4000, 8000, 15000] // 0.5s, 1s, 2s, 4s, 8s, 15s
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleSessionExpired = useCallback((message: string) => {
    logout()
    localStorage.removeItem("game_tracks")
    toast({
      title: "Session Expired",
      description: message,
      variant: "destructive"
    })
    router.replace("/")
  }, [logout, router, toast])

  const clearPlaybackTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }, [])

  const pauseCurrentPlayback = useCallback(async () => {
    if (!player) return

    try {
      await player.pause()
    } catch (error) {
      console.error("Error pausing current playback via SDK:", error)
    }

    // Secondary pause attempt 200ms later to handle SDK buffering race conditions
    setTimeout(async () => {
      try {
        const state = await player.getCurrentState()
        if (state && !state.paused) {
          console.log("⚠️ Spotify player still playing, triggering secondary pause")
          await player.pause()
        }
      } catch (e) {
        console.error("Error in secondary pause check:", e)
      }
    }, 200)

    // Call Web API pause as absolute fallback
    try {
      const validToken = await ensureValidToken()
      if (validToken) {
        await fetch("https://api.spotify.com/v1/me/player/pause", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${validToken}`,
          },
        })
      }
    } catch (error) {
      console.error("Error pausing current playback via API:", error)
    }
  }, [player, deviceId, ensureValidToken])

  const startProgressTimer = useCallback((activePlayer: SpotifyPlayer, duration: number, initialElapsed = 0) => {
    clearPlaybackTimers()

    const startTime = Date.now() - initialElapsed
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progressPercent = Math.min((elapsed / duration) * 100, 100)
      setProgress(progressPercent)
    }, 50)

    const remainingDuration = Math.max(duration - initialElapsed, 0)
    timeoutRef.current = setTimeout(async () => {
      try {
        await pauseCurrentPlayback()
        setIsPlaying(false)
        setIsPaused(false)
        clearPlaybackTimers()
        setProgress(100)
      } catch (error) {
        console.error("Error pausing track:", error)
        setIsPlaying(false)
      }
    }, remainingDuration)
  }, [clearPlaybackTimers, pauseCurrentPlayback])

  // Click outside to close autocomplete suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Clean track names for loose string comparison
  const cleanTrackName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s*\(feat\..*?\)/g, '')
      .replace(/\s*\(with.*?\)/g, '')
      .replace(/\s*-\s*remastered.*/g, '')
      .replace(/\s*-\s*radio edit.*/g, '')
      .replace(/\s*\(radio edit\)/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
  }

  // Fetch track search suggestions from Spotify Search API
  const fetchSearchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestions([])
      return
    }

    setIsSearching(true)
    try {
      const validToken = await ensureValidToken()
      if (!validToken) return

      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=6`,
        {
          headers: {
            Authorization: `Bearer ${validToken}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        const items = data.tracks?.items || []
        setSuggestions(
          items.map((item: any) => ({
            uri: item.uri,
            name: item.name,
            artists: item.artists.map((a: any) => a.name).join(", "),
            albumImage: item.album?.images?.[2]?.url || item.album?.images?.[0]?.url || null,
          }))
        )
      }
    } catch (error) {
      console.error("Error fetching search suggestions:", error)
    } finally {
      setIsSearching(false)
    }
  }, [ensureValidToken])

  // Debounced query trigger
  useEffect(() => {
    if (selectedUri) {
      return
    }

    const delayDebounceFn = setTimeout(() => {
      if (guess.trim().length > 1) {
        void fetchSearchSuggestions(guess)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [guess, selectedUri, fetchSearchSuggestions])

  // Restore game state from localStorage
  useEffect(() => {
    if (tracks.length === 0 || tracksLoading) return

    const playlistId = localStorage.getItem("current_playlist_id") || "default"
    const savedState = localStorage.getItem(`songless_state_${playlistId}`)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.currentIndex < tracks.length) {
          setCurrentIndex(parsed.currentIndex)
          setCurrentStage(parsed.currentStage)
          setGuesses(parsed.guesses || [])
          console.log("🎮 Restored game state:", parsed)
        }
      } catch (e) {
        console.error("Error parsing saved game state:", e)
      }
    }
  }, [tracks, tracksLoading])

  // Save game state to localStorage
  useEffect(() => {
    if (tracks.length === 0 || tracksLoading) return
    const playlistId = localStorage.getItem("current_playlist_id") || "default"
    const stateToSave = {
      currentIndex,
      currentStage,
      guesses
    }
    localStorage.setItem(`songless_state_${playlistId}`, JSON.stringify(stateToSave))
  }, [currentIndex, currentStage, guesses, tracks, tracksLoading])



  // Effect 1: Check authentication and redirect if needed
  useEffect(() => {
    console.log("🔍 [GamePage] Effect 1 - Checking auth and tracks:", {
      accessToken: !!accessToken,
      tracksLength: tracks.length,
      tracksLoading,
      authLoading,
      isLoading
    })

    // Wait for auth to finish loading
    if (authLoading) {
      console.log("🔍 [GamePage] Auth still loading, waiting...")
      return
    }

    if (!accessToken) {
      console.log("🔍 [GamePage] No access token, redirecting to /")
      router.push("/")
      return
    }

    if (tracksLoading) {
      console.log("🔍 [GamePage] Tracks still loading, waiting...")
      return
    }

    if (tracks.length === 0) {
      console.warn("🚨 [GamePage] No tracks — redirecting back to /playlist")
      router.push("/playlist")
      return
    }

    console.log("🔍 [GamePage] All checks passed, setting loading to false")
    setIsLoading(false)
  }, [accessToken, tracks.length, tracksLoading, authLoading, router])

  // Effect 2: Check Premium status
  useEffect(() => {
    const checkPremiumStatus = async () => {
      try {
        console.log("Checking Premium status...")

        const validToken = await ensureValidToken()
        if (!validToken) {
          handleSessionExpired("Your Spotify session expired. Please log in again.")
          return
        }
        
        // Try to access player endpoint - Premium users can access this
        const playerResponse = await fetch("https://api.spotify.com/v1/me/player", {
          headers: {
            "Authorization": `Bearer ${validToken}`
          }
        })

        if (playerResponse.status === 401) {
          handleSessionExpired("Your Spotify session expired. Please log in again.")
          return
        }

        const isPremiumUser = playerResponse.ok
          ? true
          : playerResponse.status === 403

        console.log("Player endpoint status:", playerResponse.status)
        console.log("Is Premium (based on player access):", isPremiumUser)
        setIsPremium(isPremiumUser)
        setPremiumCheckDone(true)
        
      } catch (error) {
        console.error("Error checking Premium status:", error)
        setIsPremium(false)
        setPremiumCheckDone(true)
      }
    }

    if (accessToken && !authLoading && !premiumCheckDone) {
      checkPremiumStatus()
    }
  }, [accessToken, authLoading, premiumCheckDone, ensureValidToken, handleSessionExpired])

  // Effect 3: Initialize SDK only for Premium users (separated from Premium check)
  useEffect(() => {
    // Only initialize SDK if Premium check is done and user is Premium
    if (!premiumCheckDone || !isPremium) {
      console.log("Skipping SDK initialization:", { premiumCheckDone, isPremium })
      return
    }

    // Prevent multiple initializations by checking if player already exists
    if (player) {
      console.log("Player already exists, skipping SDK initialization...")
      return
    }

    console.log("=== INITIALIZING SDK FOR PREMIUM USER ===")

    // Load Spotify Web Playback SDK
    const script = document.createElement("script")
    script.src = "https://sdk.scdn.co/spotify-player.js"
    script.async = true
    
    script.onload = () => {
      console.log("Spotify SDK script loaded successfully")
    }
    
    script.onerror = () => {
      console.error("Failed to load Spotify Web Playback SDK")
      toast({
        title: "SDK Load Failed",
        description: "Failed to load Spotify player. Please refresh the page.",
        variant: "destructive"
      })
    }
    
    document.body.appendChild(script)

    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log("=== SDK READY ===")
      console.log("Access token exists:", !!accessToken)
      console.log("Premium check done:", premiumCheckDone)
      console.log("Is Premium:", isPremium)
      
      try {
        console.log("Creating Spotify Player...")
        const spotifyPlayer = new window.Spotify.Player({
          name: "SonglessUnlimited",
          getOAuthToken: async (cb: (token: string) => void) => {
            try {
              const freshToken = await ensureValidToken()
              if (freshToken) {
                console.log("Providing fresh token to SDK")
                cb(freshToken)
              } else {
                console.error("No valid token available")
                handleSessionExpired("Your Spotify session expired. Please log in again.")
              }
            } catch (error) {
              console.error("Error getting valid token:", error)
              handleSessionExpired("Unable to refresh your Spotify session. Please log in again.")
            }
          },
          volume: 0.5,
        })

        spotifyPlayer.addListener("ready", ({ device_id }: { device_id: string }) => {
          console.log("=== PLAYER READY ===")
          console.log("Device ID:", device_id)
          console.log("Ready with Device ID", device_id)
          setDeviceId(device_id)
          setPlayer(spotifyPlayer)
          
          // Transfer playback to our device
          void ensureValidToken().then((freshToken) => {
            if (!freshToken) {
              handleSessionExpired("Your Spotify session expired. Please log in again.")
              return
            }

            console.log("Transferring playback to device...")
            fetch("https://api.spotify.com/v1/me/player", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${freshToken}`,
              },
              body: JSON.stringify({
                device_ids: [device_id],
                play: false
              }),
            }).then(response => {
              console.log("Transfer response:", response.status)
            }).catch(error => {
              console.error("Error transferring playback:", error)
            })
          })
        })

        spotifyPlayer.addListener("not_ready", ({ device_id }: { device_id: string }) => {
          console.log("Device ID has gone offline", device_id)
        })

        spotifyPlayer.addListener("initialization_error", ({ message }: { message: string }) => {
          console.error("Initialization error:", message)
          toast({
            title: "Player Initialization Error",
            description: "Failed to initialize Spotify player. Please check your Spotify Premium subscription.",
            variant: "destructive"
          })
        })

        spotifyPlayer.addListener("authentication_error", ({ message }: { message: string }) => {
          console.error("=== AUTHENTICATION ERROR DETAILS ===")
          console.error("Error message:", message)
          console.error("Current access token:", localStorage.getItem("spotify_access_token") ? "EXISTS" : "MISSING")
          console.error("Current refresh token:", localStorage.getItem("spotify_refresh_token") ? "EXISTS" : "MISSING")
          console.error("Token expires at:", localStorage.getItem("spotify_expires_at"))
          console.error("Current time:", Date.now())
          console.error("=====================================")
          
          if (message.includes("expired")) {
            handleSessionExpired("Token expired. Please log in again.")
          } else {
            handleSessionExpired("Authentication failed. Please log in again.")
          }
        })

        spotifyPlayer.addListener("account_error", ({ message }: { message: string }) => {
          console.error("Account error:", message)
          if (message.includes("Premium")) {
            toast({
              title: "Spotify Premium Required",
              description: "Spotify Premium subscription is required for the Web Playback SDK. Please upgrade to Premium to play.",
              variant: "destructive"
            })
          } else {
            toast({
              title: "Account Error",
              description: "Account error. Please check your Spotify account.",
              variant: "destructive"
            })
          }
          router.push("/playlist")
        })

        spotifyPlayer.addListener("playback_error", ({ message }: { message: string }) => {
          console.error("Playback error:", message)
          toast({
            title: "Playback Error",
            description: `Spotify Player error: ${message}. If audio fails, try skipping or resuming the song.`,
            variant: "destructive"
          })
        })

        console.log("Connecting player...")
        spotifyPlayer.connect()
      } catch (error) {
        console.error("Error creating Spotify player:", error)
        toast({
          title: "Player Error",
          description: "Failed to create Spotify player. Please refresh the page.",
          variant: "destructive"
        })
      }
    }

    return () => {
      clearPlaybackTimers()
    }
  }, [premiumCheckDone, isPremium, player, accessToken, ensureValidToken, handleSessionExpired, clearPlaybackTimers, router])

  const playSegment = async (positionMs: number | any = 0) => {
    const startPosition = typeof positionMs === "number" ? positionMs : 0

    console.log("🎵 [PlaySegment] Starting...", {
      hasPlayer: !!player,
      hasDeviceId: !!deviceId,
      tracksLength: tracks.length,
      currentIndex,
      currentStage,
      duration: stageDurations[currentStage],
      startPosition
    })
    
    if (!player || !deviceId || tracks.length === 0) {
      console.log("🎵 [PlaySegment] Missing requirements, returning")
      return
    }

    const currentTrack = tracks[currentIndex]
    const duration = stageDurations[currentStage]

    try {
      const validToken = await ensureValidToken()
      if (!validToken) {
        handleSessionExpired("Your Spotify session expired. Please log in again.")
        return
      }

      clearPlaybackTimers()

      // Step 1: Transfer playback to the SDK device to make it the active device
      // This prevents 403 "No active device" errors
      console.log("🎵 [PlaySegment] Transferring playback to SDK device:", deviceId)
      await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false, // don't auto-play yet, we'll send the specific track
        }),
      })

      // Small delay to let Spotify process the device transfer
      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 2: Play the specific track on the now-active SDK device
      const doPlay = async (): Promise<Response> => {
        return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${validToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: [currentTrack.uri],
            position_ms: startPosition,
          }),
        })
      }

      let playResponse = await doPlay()

      // If 403 (device not active yet), wait and retry once
      if (playResponse.status === 403) {
        console.log("🎵 [PlaySegment] 403 received, retrying after 800ms...")
        await new Promise(resolve => setTimeout(resolve, 800))
        playResponse = await doPlay()
      }

      if (playResponse.status === 401) {
        handleSessionExpired("Your Spotify session expired. Please log in again.")
        return
      }

      if (!playResponse.ok) {
        if (playResponse.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Spotify API rate limit exceeded. Please wait a moment and try again.",
            variant: "destructive"
          })
        } else {
          throw new Error(`Failed to play track: ${playResponse.status}`)
        }
      }

      console.log("🎵 [PlaySegment] Play API call successful")
      setIsPlaying(true)
      setIsPaused(false)
      setProgress((startPosition / duration) * 100)
      startProgressTimer(player, duration, startPosition)
    } catch (error) {
      console.error("Error playing track:", error)
      setIsPlaying(false)
      toast({
        title: "Playback Failed",
        description: "Could not start audio playback. Ensure your Spotify Premium account is active and you have a stable network connection.",
        variant: "destructive"
      })
    }
  }

  // Auto-play segment when stage or track changes (but not on initial load)
  useEffect(() => {
    if (player && deviceId && tracks.length > 0 && !isPlaying && currentStage > 0) {
      console.log("Auto-playing segment:", {
        trackIndex: currentIndex,
        stage: currentStage,
        duration: stageDurations[currentStage],
        trackName: tracks[currentIndex]?.name
      })
      playSegment()
    }
  }, [currentStage, currentIndex, player, deviceId])

  const handleGuess = () => {
    if (!guess.trim() || tracks.length === 0) return

    const currentTrack = tracks[currentIndex]
    const cleanGuess = cleanTrackName(guess)
    const cleanTarget = cleanTrackName(currentTrack.name)

    const isCorrect = (selectedUri && selectedUri === currentTrack.uri) ||
                     cleanGuess.includes(cleanTarget) ||
                     cleanTarget.includes(cleanGuess)

    void pauseCurrentPlayback()
    clearPlaybackTimers()

    const newGuesses = [...guesses, guess]
    setGuesses(newGuesses)

    if (isCorrect) {
      setModalContent({ correct: true, answer: currentTrack.name })
      setShowModal(true)
      setIsPlaying(false)
      setIsPaused(false)
      setProgress(0)
    } else if (currentStage < 5) {
      // Move to next stage
      setCurrentStage(currentStage + 1)
      setIsPlaying(false)
      setIsPaused(false)
      setProgress(0)
    } else {
      // Stage 6 is the last stage - game over
      setModalContent({ correct: false, answer: currentTrack.name })
      setShowModal(true)
      setIsPlaying(false)
      setIsPaused(false)
      setProgress(0)
    }

    setGuess("")
    setSelectedUri(null)
    setShowSuggestions(false)
  }

  const handleSkip = () => {
    console.log("🔄 [Skip] Current stage:", currentStage, "Tracks length:", tracks.length)
    
    void pauseCurrentPlayback()
    clearPlaybackTimers()

    const newGuesses = [...guesses, "SKIPPED"]
    setGuesses(newGuesses)
    
    if (currentStage < 5) {
      console.log("🔄 [Skip] Moving to next stage:", currentStage + 1)
      setCurrentStage(currentStage + 1)
      setIsPlaying(false)
      setIsPaused(false)
      setProgress(0)
    } else {
      // Stage 6 - game over
      console.log("🔄 [Skip] Stage 6 - game over")
      const currentTrack = tracks[currentIndex]
      setModalContent({ correct: false, answer: currentTrack.name })
      setShowModal(true)
      setIsPlaying(false)
      setIsPaused(false)
      setProgress(0)
    }
    setGuess("")
    setSelectedUri(null)
    setShowSuggestions(false)
  }

  const handlePause = async () => {
    if (!player || !isPlaying) return

    // Update UI state immediately — don't wait for async pause to complete
    setIsPlaying(false)
    setIsPaused(true)
    clearPlaybackTimers()

    // Fire and forget — pause runs in background
    pauseCurrentPlayback().catch(error => {
      console.error("Error pausing track:", error)
    })
  }

  const handleResume = async () => {
    if (!player || isPlaying) return

    try {
      const duration = stageDurations[currentStage]
      const elapsed = Math.round((progress / 100) * duration)
      await playSegment(elapsed)
    } catch (error) {
      console.error("Error resuming track:", error)
    }
  }

  const handleNextSong = async () => {
    console.log("🔄 [NextSong] Moving to next song")
    setShowModal(false)
    
    clearPlaybackTimers()
    
    await pauseCurrentPlayback()
    console.log("🔄 [NextSong] Forced pause successful")
    
    setGuesses([])
    
    if (currentIndex < tracks.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setCurrentStage(0)
      setProgress(0)
      setIsPlaying(false)
      setIsPaused(false)
      console.log("🔄 [NextSong] Moved to track:", currentIndex + 1)
    } else {
      // Game finished
      console.log("🔄 [NextSong] Game finished, going to playlist")
      
      const playlistId = localStorage.getItem("current_playlist_id") || "default"
      localStorage.removeItem(`songless_state_${playlistId}`)
      localStorage.removeItem("current_playlist_id")
      localStorage.removeItem("game_tracks")
      
      router.push("/playlist")
    }
  }

  const handleBackToPlaylist = () => {
    setShowModal(false)
    router.push("/playlist")
  }

  const handleExitPlaylist = () => {
    // Clear tracks and go back to playlist page
    clearPlaybackTimers()
    if (player) {
      player.disconnect()
    }
    const playlistId = localStorage.getItem("current_playlist_id") || "default"
    localStorage.removeItem(`songless_state_${playlistId}`)
    localStorage.removeItem("current_playlist_id")
    localStorage.removeItem("game_tracks")
    router.push("/playlist")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <p className="text-white">Loading game...</p>
        </div>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white mb-4">No tracks loaded</p>
          <Button onClick={() => router.push("/playlist")} className="bg-green-600 hover:bg-green-700">
            Back to Playlist
          </Button>
        </div>
      </div>
    )
  }

  if (currentIndex >= tracks.length) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">🎉 Game Complete!</h1>
          <p className="text-gray-400 mb-6">You've played all songs in the playlist</p>
          <Button 
            onClick={() => {
              const playlistId = localStorage.getItem("current_playlist_id") || "default"
              localStorage.removeItem(`songless_state_${playlistId}`)
              localStorage.removeItem("current_playlist_id")
              localStorage.removeItem("game_tracks")
              router.push("/playlist")
            }} 
            className="bg-green-600 hover:bg-green-700"
          >
            Play Another Playlist
          </Button>
        </div>
      </div>
    )
  }

  if (!premiumCheckDone) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <p className="text-white">Checking Premium status...</p>
        </div>
      </div>
    )
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-black p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-500">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-white text-xl font-bold">Spotify Premium Required</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Spotify requires a **Premium account** to stream tracks directly in third-party web apps using the SDK.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-800/80 space-y-2">
              <div className="flex items-center space-x-2 text-green-400">
                <Sparkles className="w-4 h-4" />
                <span className="font-semibold text-xs uppercase tracking-wider">How Web SDK Works</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                The game relies on the official Spotify Web Playback SDK to play specific song segments (e.g., 0.5s, 1s) seamlessly. Spotify restricts this service to Premium members.
              </p>
            </div>

            <div className="bg-gray-900/60 p-4 rounded-xl border border-gray-800/80 space-y-2">
              <div className="flex items-center space-x-2 text-green-400">
                <Smartphone className="w-4 h-4" />
                <span className="font-semibold text-xs uppercase tracking-wider">Need Premium?</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                You can still browse and guess songs, but audio playback will remain disabled. Consider upgrading your Spotify account if you want the full game experience.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => router.push("/playlist")}
              className="bg-green-600 hover:bg-green-700 w-full"
            >
              Back to Playlists
            </Button>
            {tracks.length > 0 && currentIndex < tracks.length && (
              <Button
                variant="outline"
                onClick={() => {
                  if (currentIndex < tracks.length - 1) {
                    setCurrentIndex(currentIndex + 1)
                  } else {
                    router.push("/playlist")
                  }
                }}
                className="bg-gray-900 hover:bg-gray-800 text-white border-gray-800 w-full"
              >
                Skip Track ({currentIndex + 1}/{tracks.length})
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const currentTrack = tracks[currentIndex]

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header with Exit Button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">SonglessUnlimited</h1>
          <Button
            onClick={handleExitPlaylist}
            variant="outline"
            size="sm"
            className="bg-red-600/20 border-red-500 text-red-400 hover:bg-red-600/30"
          >
            <X className="w-4 h-4 mr-1" />
            Exit Playlist
          </Button>
        </div>

        {/* Game Info with better contrast */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 mb-6">
          <div className="text-center space-y-2">
            <p className="text-gray-300 text-lg">Track {currentIndex + 1} of {tracks.length}</p>
            <div className="flex justify-center items-center space-x-4">
              <div className="bg-green-600/20 border border-green-500 rounded-lg px-4 py-2">
                <p className="text-green-400 text-xl font-bold">Stage {currentStage + 1} of 6</p>
              </div>
              <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg px-4 py-2">
                <p className="text-yellow-400 text-lg font-semibold">{(stageDurations[currentStage] / 1000).toFixed(1)}s</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              {currentStage === 0 && "First preview - 0.5 seconds"}
              {currentStage === 1 && "Second preview - 1 second"}
              {currentStage === 2 && "Third preview - 2 seconds"}
              {currentStage === 3 && "Fourth preview - 4 seconds"}
              {currentStage === 4 && "Fifth preview - 8 seconds"}
              {currentStage === 5 && "Final preview - 15 seconds"}
            </p>
          </div>
        </div>

        {/* Progress bar with better design */}
        <div className="mb-8">
          <div className="bg-gray-800 rounded-full h-5 overflow-hidden border-2 border-gray-600 shadow-inner">
            <div 
              className={`h-full transition-all duration-100 ease-out relative ${
                isPlaying 
                  ? 'bg-gradient-to-r from-green-500 via-green-400 to-green-300' 
                  : 'bg-gradient-to-r from-gray-500 via-gray-400 to-gray-300'
              }`}
              style={{ width: `${progress}%` }}
            >
              {/* Subtle shine effect only when playing */}
              {isPlaying && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"></div>
              )}
            </div>
          </div>
          <div className="flex justify-between text-sm mt-3">
            <span className="text-gray-300 font-medium">0:00</span>
            <span className={`font-bold text-lg ${isPlaying ? 'text-yellow-400' : 'text-gray-400'}`}>
              {(stageDurations[currentStage] / 1000).toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex justify-center gap-4 mb-8">
          <Button
            onClick={isPaused ? handleResume : () => playSegment()}
            aria-label={isPaused ? "Resume playback" : "Play preview"}
            size="lg"
            className="rounded-full w-20 h-20 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/25"
            disabled={isPlaying}
          >
            <Play className="w-8 h-8 fill-white" />
          </Button>
          <Button
            onClick={handlePause}
            aria-label="Pause playback"
            size="lg"
            variant="outline"
            className="rounded-full w-20 h-20 border-gray-500 bg-gray-800 text-white hover:bg-gray-700"
            disabled={!isPlaying}
          >
            Pause
          </Button>
        </div>

        {/* Previous guesses list */}
        <div className="space-y-2 mb-6 border border-gray-800 rounded-lg p-3 bg-gray-900/20">
          {Array.from({ length: 6 }).map((_, index) => {
            const guessText = guesses[index]
            const isCurrent = index === currentStage
            const isPast = index < currentStage

            return (
              <div 
                key={index} 
                className={`h-9 flex items-center px-3 rounded border text-sm font-medium ${
                  isCurrent 
                    ? 'border-gray-500 bg-gray-800/40 text-gray-300' 
                    : isPast 
                    ? guessText === 'SKIPPED'
                      ? 'border-gray-800 bg-gray-950/50 text-gray-500 line-through'
                      : 'border-red-950 bg-red-950/10 text-red-400/80'
                    : 'border-gray-800 bg-transparent text-gray-700 select-none'
                }`}
              >
                <span className="w-6 text-xs text-gray-500 mr-2">{index + 1}</span>
                {isPast ? (
                  <span className="truncate">{guessText}</span>
                ) : isCurrent ? (
                  <span className="animate-pulse text-gray-500">Type your guess or skip...</span>
                ) : (
                  <span></span>
                )}
              </div>
            )
          })}
        </div>

        {/* Guess input */}
        <div className="space-y-4">
          <div ref={searchContainerRef} className="relative">
            <Input
              type="text"
              placeholder="Know it? Search for the title"
              value={guess}
              onChange={(e) => {
                setGuess(e.target.value)
                setSelectedUri(null)
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => e.key === "Enter" && handleGuess()}
              className="bg-gray-800 border-gray-600 text-white text-lg h-12 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            />
            {isSearching && (
              <div className="absolute right-3 top-3.5">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            )}
            
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-800">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.uri}
                    type="button"
                    onClick={() => {
                      setGuess(`${suggestion.artists} - ${suggestion.name}`)
                      setSelectedUri(suggestion.uri)
                      setShowSuggestions(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-800 flex items-center space-x-3 transition-colors"
                  >
                    {suggestion.albumImage ? (
                      <img 
                        src={suggestion.albumImage} 
                        alt="" 
                        className="w-8 h-8 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-800 rounded flex-shrink-0"></div>
                    )}
                    <div className="truncate">
                      <p className="text-white font-medium truncate">{suggestion.name}</p>
                      <p className="text-gray-400 text-xs truncate">{suggestion.artists}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleSkip}
              variant="outline"
              className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600 h-12 font-semibold"
            >
              SKIP TO NEXT ({currentStage + 1}/6)
            </Button>
            <Button 
              onClick={handleGuess} 
              className="flex-1 bg-green-600 hover:bg-green-700 h-12 font-semibold shadow-lg shadow-green-500/25" 
              disabled={!guess.trim()}
            >
              SUBMIT
            </Button>
          </div>
        </div>

        <GameModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          correct={modalContent.correct}
          answer={modalContent.answer}
          onNext={handleNextSong}
          onBack={handleBackToPlaylist}
          guesses={guesses}
          trackIndex={currentIndex}
        />
      </div>
    </div>
  )
}

