"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Play, Pause, Loader2, X, Music, AlertTriangle, Smartphone, Sparkles, ExternalLink, SkipForward, Check } from "lucide-react"
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
  activateElement: () => Promise<void>
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
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    audioRef.current = new Audio()
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])
  const { tracks, isLoading: tracksLoading } = useTracks()
  const { accessToken, ensureValidToken, isLoading: authLoading, logout } = useSpotifyAuth()
  const [isPremium, setIsPremium] = useState(true)
  const [premiumCheckDone, setPremiumCheckDone] = useState(false)
  const [sdkPlaybackFailed, setSdkPlaybackFailed] = useState(false)

  const currentTrackRef = useRef<any>(null)
  const playSegmentRef = useRef<any>(null)
  const isPlayingFallbackRef = useRef(false)
  
  useEffect(() => {
    currentTrackRef.current = tracks[currentIndex]
  }, [tracks, currentIndex])

  useEffect(() => {
    playSegmentRef.current = playSegment
  })

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
    if (audioRef.current) {
      audioRef.current.pause()
    }
    
    if (isPlayingFallbackRef.current) {
      console.log("🎵 [Pause] Paused fallback HTML5 audio")
      return
    }

    if (!player) return

    try {
      await player.pause()
    } catch (error) {
      console.warn("Error pausing current playback via SDK:", error)
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
        console.warn("Error in secondary pause check:", e)
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
      console.warn("Error pausing current playback via API:", error)
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
        console.warn("Error pausing track:", error)
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
      console.warn("Error fetching search suggestions:", error)
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
        console.warn("Error parsing saved game state:", e)
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
        console.log("Checking Premium status via User Profile API...")

        const validToken = await ensureValidToken()
        if (!validToken) {
          handleSessionExpired("Your Spotify session expired. Please log in again.")
          return
        }
        
        // Fetch user profile to check product type
        const userResponse = await fetch("https://api.spotify.com/v1/me", {
          headers: {
            "Authorization": `Bearer ${validToken}`
          }
        })

        if (userResponse.status === 401) {
          handleSessionExpired("Your Spotify session expired. Please log in again.")
          return
        }

        if (userResponse.ok) {
          const userData = await userResponse.json()
          const isPremiumUser = userData.product === "premium"
          console.log("User product status:", userData.product)
          console.log("Is Premium:", isPremiumUser)
          setIsPremium(isPremiumUser)
        } else {
          console.warn("Failed to fetch user profile status, status code:", userResponse.status)
          setIsPremium(false)
        }
        setPremiumCheckDone(true)
        
      } catch (error) {
        console.warn("Error checking Premium status:", error)
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
      console.warn("Failed to load Spotify Web Playback SDK")
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
          console.warn("Initialization error:", message)
          toast({
            title: "Player Initialization Error",
            description: "Failed to initialize Spotify player. Please check your Spotify Premium subscription.",
            variant: "destructive"
          })
        })

        spotifyPlayer.addListener("authentication_error", ({ message }: { message: string }) => {
          console.warn("=== AUTHENTICATION ERROR DETAILS ===")
          console.warn("Error message:", message)
          console.warn("Current access token:", localStorage.getItem("spotify_access_token") ? "EXISTS" : "MISSING")
          console.warn("Current refresh token:", localStorage.getItem("spotify_refresh_token") ? "EXISTS" : "MISSING")
          console.warn("Token expires at:", localStorage.getItem("spotify_expires_at"))
          console.warn("Current time:", Date.now())
          console.warn("=====================================")
          
          if (message.includes("expired")) {
            handleSessionExpired("Token expired. Please log in again.")
          } else {
            handleSessionExpired("Authentication failed. Please log in again.")
          }
        })

        spotifyPlayer.addListener("account_error", ({ message }: { message: string }) => {
          console.warn("Account error:", message)
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
          console.warn("Playback error:", message)
          
          if (message.includes("Cannot perform operation; no list was loaded")) {
            return
          }

          const activeTrack = currentTrackRef.current
          if (activeTrack?.preview_url) {
            console.warn("Spotify SDK playback error. Falling back to preview URL.")
            setSdkPlaybackFailed(true)
            setTimeout(() => {
              if (playSegmentRef.current) {
                playSegmentRef.current(0, true)
              }
            }, 100)
            return
          }

          toast({
            title: "Playback Error",
            description: `Spotify Player error: ${message}. If audio fails, try skipping or resuming the song.`,
            variant: "destructive"
          })
        })

        console.log("Connecting player...")
        spotifyPlayer.connect()
      } catch (error) {
        console.warn("Error creating Spotify player:", error)
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

  const playSegment = async (positionMs: number | any = 0, forceFallback = false) => {
    const startPosition = typeof positionMs === "number" ? positionMs : 0
    const currentTrack = tracks[currentIndex]
    
    if (!currentTrack) return
    
    const duration = stageDurations[currentStage]
    // Prioritise HTML5 preview player for smooth play/pause segments if preview_url is available
    const useFallback = !!currentTrack.preview_url || !isPremium || !player || !deviceId || sdkPlaybackFailed || forceFallback

    console.log("🎵 [PlaySegment] Starting...", {
      hasPlayer: !!player,
      hasDeviceId: !!deviceId,
      tracksLength: tracks.length,
      currentIndex,
      currentStage,
      duration,
      startPosition,
      useFallback
    })

    if (useFallback) {
      if (!currentTrack.preview_url) {
        toast({
          title: "Preview Unavailable",
          description: "This track has no preview available and Spotify Premium is required for full playback.",
          variant: "destructive"
        })
        return
      }
      
      try {
        clearPlaybackTimers()
        isPlayingFallbackRef.current = true
        if (audioRef.current) {
          if (!audioRef.current.src || audioRef.current.src !== currentTrack.preview_url) {
            audioRef.current.src = currentTrack.preview_url
          }
          audioRef.current.currentTime = startPosition / 1000
          await audioRef.current.play()
        }
        
        setIsPlaying(true)
        setIsPaused(false)
        setProgress((startPosition / duration) * 100)
        startProgressTimer(player as any, duration, startPosition)
      } catch (error) {
        console.error("Error playing fallback audio:", error)
        setIsPlaying(false)
      }
      return
    }

    try {
      const validToken = await ensureValidToken()
      if (!validToken) {
        handleSessionExpired("Your Spotify session expired. Please log in again.")
        return
      }

      clearPlaybackTimers()
      isPlayingFallbackRef.current = false

      // Define play function
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

      // Try playing directly
      let playResponse = await doPlay()

      // If 403/404 (device not active/found), transfer playback and retry once
      if (playResponse.status === 403 || playResponse.status === 404) {
        console.log("🎵 [PlaySegment] Device not active (403/404). Transferring playback to SDK device:", deviceId)
        await fetch("https://api.spotify.com/v1/me/player", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${validToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            device_ids: [deviceId],
            play: false,
          }),
        })

        // Wait 800ms for Spotify to process the device transfer
        await new Promise(resolve => setTimeout(resolve, 800))
        
        // Retry playing
        playResponse = await doPlay()
      }

      if (playResponse.status === 401) {
        handleSessionExpired("Your Spotify session expired. Please log in again.")
        return
      }

      if (!playResponse.ok) {
        throw new Error(playResponse.status === 429 ? "Rate limit exceeded" : `Failed to play track: ${playResponse.status}`)
      }

      console.log("🎵 [PlaySegment] Play API call successful")
      setIsPlaying(true)
      setIsPaused(false)
      setProgress((startPosition / duration) * 100)
      startProgressTimer(player, duration, startPosition)
    } catch (error) {
      console.warn("Error playing track:", error)
      setIsPlaying(false)
      
      if (currentTrack?.preview_url) {
        console.warn("API/SDK play call failed. Falling back to preview URL.")
        toast({
          title: "Switching to Preview",
          description: "Premium player limit reached. Using preview audio.",
        })
        setSdkPlaybackFailed(true)
        setTimeout(() => {
          if (playSegmentRef.current) {
            playSegmentRef.current(startPosition, true)
          }
        }, 100)
        return
      }

      toast({
        title: "Playback Failed",
        description: error instanceof Error && error.message.includes("Rate limit") 
          ? "Spotify API rate limit exceeded. Please wait a moment." 
          : "Could not start audio playback. Ensure your Spotify Premium account is active.",
        variant: "destructive"
      })
    }
  }



  const handleGuess = () => {
    if (!guess.trim() || tracks.length === 0) return

    const currentTrack = tracks[currentIndex]
    const cleanGuess = cleanTrackName(guess)
    const cleanTarget = cleanTrackName(currentTrack.name)

    const isCorrect = (selectedUri && selectedUri === currentTrack.uri) ||
                     cleanGuess.includes(cleanTarget) ||
                     cleanTarget.includes(cleanGuess)

    if (isPlaying) {
      void pauseCurrentPlayback()
    }
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
    
    if (isPlaying) {
      void pauseCurrentPlayback()
    }
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
      console.warn("Error pausing track:", error)
    })
  }

  const handleResume = async () => {
    if (isPlaying) return

    if (isPlayingFallbackRef.current) {
      try {
        if (audioRef.current) {
          await audioRef.current.play()
          setIsPlaying(true)
          setIsPaused(false)
          const duration = stageDurations[currentStage]
          const elapsed = Math.round((progress / 100) * duration)
          startProgressTimer(null as any, duration, elapsed)
        }
      } catch (error) {
        console.warn("Error resuming fallback audio:", error)
      }
      return
    }

    if (!player) return

    try {
      const duration = stageDurations[currentStage]
      const elapsed = Math.round((progress / 100) * duration)
      await playSegment(elapsed)
    } catch (error) {
      console.warn("Error resuming track:", error)
    }
  }

  const handleNextSong = async () => {
    console.log("🔄 [NextSong] Moving to next song")
    setShowModal(false)
    
    clearPlaybackTimers()
    
    if (isPlaying) {
      await pauseCurrentPlayback()
      console.log("🔄 [NextSong] Forced pause successful")
    }
    
    setGuesses([])
    
    if (currentIndex < tracks.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setCurrentStage(0)
      setProgress(0)
      setIsPlaying(false)
      setIsPaused(false)
      setSdkPlaybackFailed(false)
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
    setSdkPlaybackFailed(false)
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
      <div className="min-h-screen bg-[#030712] text-gray-100 flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none" />
        <div className="text-center relative z-10">
          <Loader2 className="w-10 h-10 text-green-400 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold tracking-wider bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Loading Game Session</h2>
          <p className="text-gray-500 text-sm mt-1">Preparing your playlist...</p>
        </div>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="min-h-screen bg-[#030712] text-gray-100 flex items-center justify-center relative overflow-hidden font-sans p-4">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none" />
        <div className="text-center relative z-10 max-w-md bg-gray-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">No Tracks Loaded</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            We couldn't find any tracks to start the game. Please go back and load a Spotify playlist first.
          </p>
          <Button 
            onClick={() => router.push("/playlist")} 
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold h-12 rounded-xl transition-all shadow-lg shadow-green-500/20"
          >
            Back to Playlist
          </Button>
        </div>
      </div>
    )
  }

  if (currentIndex >= tracks.length) {
    return (
      <div className="min-h-screen bg-[#030712] text-gray-100 flex items-center justify-center relative overflow-hidden font-sans p-4">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none" />
        <div className="text-center relative z-10 max-w-md bg-gray-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
          <Sparkles className="w-12 h-12 text-yellow-400 mx-auto mb-4 animate-pulse" />
          <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">🎉 Playlist Completed!</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Amazing job! You've successfully played through all the songs in this playlist.
          </p>
          <Button 
            onClick={() => {
              const playlistId = localStorage.getItem("current_playlist_id") || "default"
              localStorage.removeItem(`songless_state_${playlistId}`)
              localStorage.removeItem("current_playlist_id")
              localStorage.removeItem("game_tracks")
              router.push("/playlist")
            }} 
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold h-12 rounded-xl transition-all shadow-lg shadow-green-500/20"
          >
            Play Another Playlist
          </Button>
        </div>
      </div>
    )
  }

  if (!premiumCheckDone) {
    return (
      <div className="min-h-screen bg-[#030712] text-gray-100 flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none" />
        <div className="text-center relative z-10">
          <Loader2 className="w-10 h-10 text-green-400 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold tracking-wider bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Verifying Account Status</h2>
          <p className="text-gray-500 text-sm mt-1">Connecting to Spotify Services...</p>
        </div>
      </div>
    )
  }

  const currentTrack = tracks[currentIndex]

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col relative overflow-hidden font-sans p-4 sm:p-6 md:p-8">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-center py-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 animate-fade-in">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,197,94,0.15)]">
            Songless<span className="text-white font-light">Unlimited</span>
          </h1>
          <Button
            onClick={handleExitPlaylist}
            variant="outline"
            size="sm"
            className="bg-transparent border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all"
          >
            <X className="w-4 h-4 mr-1.5" />
            Exit Game
          </Button>
        </div>

        {/* Game Info Dashboard */}
        <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl animate-slide-up">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left space-y-1">
              <span className="text-xs font-semibold text-green-400 uppercase tracking-widest">Playlist Progress</span>
              <h2 className="text-white font-extrabold text-xl">Track {currentIndex + 1} <span className="text-gray-500 text-sm font-normal">of {tracks.length}</span></h2>
            </div>
            
            <div className="flex gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5 text-center">
                <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-0.5">Current Stage</p>
                <p className="text-white font-extrabold text-lg leading-none">{currentStage + 1} / 6</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5 text-center">
                <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider mb-0.5">Clip Duration</p>
                <p className="text-white font-extrabold text-lg leading-none">{(stageDurations[currentStage] / 1000).toFixed(1)}s</p>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Split Segment Timeline Progress Bar */}
        <div className="bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl animate-slide-up">
          <div className="relative mb-3">
            {/* The main bar */}
            <div className="bg-gray-950/80 rounded-full h-4 overflow-hidden relative border border-white/5 shadow-inner">
              
              {/* Unlocked region background */}
              <div 
                className="absolute left-0 top-0 bottom-0 bg-gray-800/20 transition-all duration-300"
                style={{ width: `${(stageDurations[currentStage] / 15000) * 100}%` }}
              />

              {/* Played active green progress */}
              <div 
                className={`h-full transition-all duration-100 ease-out absolute left-0 top-0 bottom-0 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full ${
                  isPlaying ? 'shadow-[0_0_15px_rgba(34,197,94,0.5)]' : ''
                }`}
                style={{ width: `${(progress / 100) * (stageDurations[currentStage] / 15000) * 100}%` }}
              >
                {/* Glowing playhead */}
                {isPlaying && (
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_10px_#fff] animate-pulse" />
                )}
              </div>

              {/* Stage dividers */}
              <div className="absolute inset-0 pointer-events-none flex justify-between">
                <div className="absolute left-[3.33%] top-0 bottom-0 w-[1px] bg-gray-950/80" /> {/* 0.5s */}
                <div className="absolute left-[6.67%] top-0 bottom-0 w-[1px] bg-gray-950/80" /> {/* 1s */}
                <div className="absolute left-[13.33%] top-0 bottom-0 w-[1px] bg-gray-950/80" /> {/* 2s */}
                <div className="absolute left-[26.67%] top-0 bottom-0 w-[1px] bg-gray-950/80" /> {/* 4s */}
                <div className="absolute left-[53.33%] top-0 bottom-0 w-[1px] bg-gray-950/80" /> {/* 8s */}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-semibold text-gray-500 px-1">
            <span>0s</span>
            <div className="flex space-x-7 sm:space-x-8">
              <span>0.5s</span>
              <span>1s</span>
              <span>2s</span>
              <span>4s</span>
              <span>8s</span>
            </div>
            <span className="text-green-400 font-bold">15s</span>
          </div>
        </div>

        {/* Playback Primary Control */}
        <div className="flex justify-center items-center gap-6 mb-8 animate-slide-up">
          <Button
            onClick={() => {
              if (isPlaying) {
                handlePause()
                return
              }

              // Synchronously activate audio elements to bypass autoplay browser restrictions
              if (player) {
                player.activateElement().catch((e: any) => {
                  console.warn("Failed to activate Spotify player element:", e)
                })
              }
              if (audioRef.current) {
                try {
                  audioRef.current.load()
                } catch (e) {
                  console.warn("Failed to load HTML5 audio context:", e)
                }
              }
              
              if (isPaused) {
                handleResume()
              } else {
                playSegment()
              }
            }}
            aria-label={isPlaying ? "Pause playback" : isPaused ? "Resume playback" : "Play preview"}
            className={`rounded-full w-24 h-24 flex items-center justify-center transition-all duration-300 relative group overflow-hidden ${
              isPlaying 
                ? "bg-red-500 hover:bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.3)]" 
                : "bg-green-500 hover:bg-green-600 shadow-[0_0_35px_rgba(34,197,94,0.4)] hover:scale-105 active:scale-95 animate-pulse-glow"
            }`}
            disabled={!isPlaying && isPlaying}
          >
            {isPlaying ? (
              <Pause className="w-10 h-10 fill-white text-white z-10" />
            ) : (
              <Play className="w-10 h-10 fill-white ml-2 text-white z-10" />
            )}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </Button>
        </div>

        {/* Guess Log Panel */}
        <div className="bg-gray-900/20 backdrop-blur-xl border border-white/5 rounded-2xl p-4 mb-6 shadow-2xl animate-slide-up space-y-2.5">
          {Array.from({ length: 6 }).map((_, index) => {
            const guessText = guesses[index]
            const isCurrent = index === currentStage
            const isPast = index < currentStage

            return (
              <div 
                key={index} 
                className={`h-11 flex items-center px-4 rounded-xl border text-sm font-medium transition-all duration-300 ${
                  isCurrent 
                    ? 'border-green-500/50 bg-green-500/5 text-gray-200 shadow-[0_0_15px_rgba(34,197,94,0.05)]' 
                    : isPast 
                    ? guessText === 'SKIPPED'
                      ? 'border-white/5 bg-gray-950/20 text-gray-500 line-through'
                      : 'border-red-500/30 bg-red-950/10 text-red-400'
                    : 'border-white/5 bg-transparent text-gray-700 select-none'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold mr-3 ${
                  isCurrent 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : isPast 
                    ? guessText === 'SKIPPED'
                      ? 'bg-gray-950 text-gray-600'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-white/5 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                
                {isPast ? (
                  <span className="truncate tracking-wide">{guessText}</span>
                ) : isCurrent ? (
                  <span className="animate-pulse text-gray-500 font-normal">Listening window unlocked...</span>
                ) : (
                  <span className="text-gray-800 font-light">• Locked •</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Input & Action Panel */}
        <div className="space-y-4 animate-slide-up">
          <div ref={searchContainerRef} className="relative">
            <div className="absolute left-4 top-3.5 text-gray-500">
              <span className="text-lg">🔍</span>
            </div>
            <Input
              type="text"
              placeholder="Know the song? Search artist or title..."
              value={guess}
              onChange={(e) => {
                setGuess(e.target.value)
                setSelectedUri(null)
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => e.key === "Enter" && handleGuess()}
              className="bg-gray-950/60 border-white/10 text-white text-base h-13 pl-12 pr-12 rounded-xl focus-visible:ring-green-500/50 focus-visible:border-green-500/50 placeholder-gray-600 transition-all shadow-inner"
            />
            {isSearching && (
              <div className="absolute right-4 top-4">
                <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
              </div>
            )}
            
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-[#0d1527] border border-white/10 rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] max-h-60 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.uri}
                    type="button"
                    onClick={() => {
                      setGuess(`${suggestion.artists} - ${suggestion.name}`)
                      setSelectedUri(suggestion.uri)
                      setShowSuggestions(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center space-x-3 transition-colors group"
                  >
                    {suggestion.albumImage ? (
                      <img 
                        src={suggestion.albumImage} 
                        alt="" 
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/5 shadow"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-800 rounded-lg flex-shrink-0 border border-white/5 flex items-center justify-center">
                        <Music className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                    <div className="truncate">
                      <p className="text-gray-200 font-bold group-hover:text-green-400 transition-colors truncate text-sm">{suggestion.name}</p>
                      <p className="text-gray-500 text-xs truncate mt-0.5">{suggestion.artists}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSkip}
              variant="outline"
              className="flex-1 bg-gray-950/40 border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white h-13 rounded-xl font-semibold transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              <SkipForward className="w-4 h-4 text-gray-400" />
              <span>SKIP (+{currentStage === 5 ? '0' : ((stageDurations[currentStage + 1] - stageDurations[currentStage]) / 1000).toFixed(1)}s)</span>
            </Button>
            <Button 
              onClick={handleGuess} 
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold h-13 rounded-xl transition-all shadow-lg shadow-green-500/10 hover:shadow-green-500/20 active:scale-[0.98] flex items-center justify-center space-x-2" 
              disabled={!guess.trim()}
            >
              <Check className="w-4 h-4" />
              <span>SUBMIT GUESS</span>
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

