"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Play, Pause, ArrowRight, Loader2, X } from "lucide-react"
import { GameModal } from "@/components/game-modal"
import { useTracks } from "@/hooks/tracks-store"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"

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
  const router = useRouter()
  const { tracks, isLoading: tracksLoading } = useTracks()
  const { accessToken, ensureValidToken, isLoading: authLoading } = useSpotifyAuth()
  const [isPremium, setIsPremium] = useState(true)
  const [premiumCheckDone, setPremiumCheckDone] = useState(false)

  const stageDurations = [500, 1000, 2000, 4000, 8000, 15000] // 0.5s, 1s, 2s, 4s, 8s, 15s
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

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
        
        // Try to access player endpoint - Premium users can access this
        const playerResponse = await fetch("https://api.spotify.com/v1/me/player", {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
        
        // If we can access player endpoint, user likely has Premium
        const isPremiumUser = playerResponse.status !== 403
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

    if (accessToken && !authLoading) {
      checkPremiumStatus()
    }
  }, [accessToken, authLoading])

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
      alert("Failed to load Spotify player. Please refresh the page.")
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
              }
            } catch (error) {
              console.error("Error getting valid token:", error)
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
          if (accessToken) {
            console.log("Transferring playback to device...")
            fetch("https://api.spotify.com/v1/me/player", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
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
          }
        })

        spotifyPlayer.addListener("not_ready", ({ device_id }: { device_id: string }) => {
          console.log("Device ID has gone offline", device_id)
        })

        spotifyPlayer.addListener("initialization_error", ({ message }: { message: string }) => {
          console.error("Initialization error:", message)
          alert("Failed to initialize Spotify player. Please check your Spotify Premium subscription.")
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
            alert("Token expired. Please login again.")
            router.push("/playlist")
          } else {
            alert("Authentication failed. Please login again.")
            router.push("/playlist")
          }
        })

        spotifyPlayer.addListener("account_error", ({ message }: { message: string }) => {
          console.error("Account error:", message)
          if (message.includes("Premium")) {
            alert("Spotify Premium subscription required for Web Playback SDK. Please upgrade to Premium to play games.")
          } else {
            alert("Account error. Please check your Spotify account.")
          }
          router.push("/playlist")
        })

        spotifyPlayer.addListener("playback_error", ({ message }: { message: string }) => {
          console.error("Playback error:", message)
        })

        console.log("Connecting player...")
        spotifyPlayer.connect()
      } catch (error) {
        console.error("Error creating Spotify player:", error)
        alert("Failed to create Spotify player. Please refresh the page.")
      }
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [premiumCheckDone, isPremium, player, accessToken, ensureValidToken, router])

  const playSegment = async () => {
    console.log("🎵 [PlaySegment] Starting...", {
      hasPlayer: !!player,
      hasDeviceId: !!deviceId,
      tracksLength: tracks.length,
      currentIndex,
      currentStage,
      duration: stageDurations[currentStage]
    })
    
    if (!player || !deviceId || tracks.length === 0) {
      console.log("🎵 [PlaySegment] Missing requirements, returning")
      return
    }

    const currentTrack = tracks[currentIndex]
    const duration = stageDurations[currentStage]

    try {
      // Play the track using Spotify Web API
      const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: [currentTrack.uri],
          position_ms: 0,
        }),
      })

      if (!playResponse.ok) {
        throw new Error(`Failed to play track: ${playResponse.status}`)
      }

      console.log("🎵 [PlaySegment] Play API call successful")
      setIsPlaying(true)
      setProgress(0)

      // Start progress tracking with smoother updates
      const startTime = Date.now()
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progressPercent = Math.min((elapsed / duration) * 100, 100)
        setProgress(progressPercent)
      }, 50) // Update more frequently for smoother animation

      // Pause after duration
      timeoutRef.current = setTimeout(async () => {
        try {
          await player.pause()
          setIsPlaying(false)
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
          }
          setProgress(100)
        } catch (error) {
          console.error("Error pausing track:", error)
          setIsPlaying(false)
        }
      }, duration)
    } catch (error) {
      console.error("Error playing track:", error)
      setIsPlaying(false)
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
    const isCorrect = guess.toLowerCase().includes(currentTrack.name.toLowerCase()) ||
                     currentTrack.name.toLowerCase().includes(guess.toLowerCase())

    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    if (isCorrect) {
      setModalContent({ correct: true, answer: currentTrack.name })
      setShowModal(true)
      setIsPlaying(false)
      setProgress(0)
    } else if (currentStage < 5) {
      // Move to next stage
      setCurrentStage(currentStage + 1)
    } else {
      // Stage 6 is the last stage - game over
      setModalContent({ correct: false, answer: currentTrack.name })
      setShowModal(true)
      setIsPlaying(false)
      setProgress(0)
    }

    setGuess("")
  }

  const handleSkip = () => {
    console.log("🔄 [Skip] Current stage:", currentStage, "Tracks length:", tracks.length)
    
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      console.log("🔄 [Skip] Cleared timeout")
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      console.log("🔄 [Skip] Cleared interval")
    }
    
    if (currentStage < 5) {
      console.log("🔄 [Skip] Moving to next stage:", currentStage + 1)
      setCurrentStage(currentStage + 1)
      setIsPlaying(false)
      setProgress(0)
    } else {
      // Stage 6 - game over
      console.log("🔄 [Skip] Stage 6 - game over")
      const currentTrack = tracks[currentIndex]
      setModalContent({ correct: false, answer: currentTrack.name })
      setShowModal(true)
      setIsPlaying(false)
      setProgress(0)
    }
  }

  const handlePause = async () => {
    if (!player || !isPlaying) return

    try {
      await player.pause()
      setIsPlaying(false)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    } catch (error) {
      console.error("Error pausing track:", error)
    }
  }

  const handleNextSong = async () => {
    console.log("🔄 [NextSong] Moving to next song")
    setShowModal(false)
    
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      console.log("🔄 [NextSong] Cleared timeout")
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      console.log("🔄 [NextSong] Cleared interval")
    }
    
    // Force pause playback
    if (player && isPlaying) {
      try {
        await player.pause()
        console.log("🔄 [NextSong] Forced pause successful")
      } catch (error) {
        console.error("🔄 [NextSong] Error forcing pause:", error)
      }
    }
    
    if (currentIndex < tracks.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setCurrentStage(0)
      setProgress(0)
      setIsPlaying(false)
      console.log("🔄 [NextSong] Moved to track:", currentIndex + 1)
    } else {
      // Game finished
      console.log("🔄 [NextSong] Game finished, going to playlist")
      router.push("/playlist")
    }
  }

  const handleBackToPlaylist = () => {
    setShowModal(false)
    router.push("/playlist")
  }

  const handleExitPlaylist = () => {
    // Clear tracks and go back to playlist page
    if (player) {
      player.disconnect()
    }
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
          <Button onClick={() => router.push("/playlist")} className="bg-green-600 hover:bg-green-700">
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
      <div className="min-h-screen bg-black p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-8">SonglessUnlimited</h1>
          
          <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-6 mb-6">
            <h2 className="text-yellow-400 text-xl font-semibold mb-2">⚠️ Premium Required</h2>
            <p className="text-yellow-200 mb-4">
              Spotify Premium subscription is required to play SonglessUnlimited with audio playback.
            </p>
            <p className="text-gray-300 text-sm">
              You can still view track information and play a text-based version of the game.
            </p>
          </div>

          {tracks.length > 0 && currentIndex < tracks.length && (
            <div className="bg-gray-900 border-gray-700 rounded-lg p-6">
              <h3 className="text-white text-lg font-semibold mb-4">Track {currentIndex + 1} of {tracks.length}</h3>
              <div className="text-center">
                <p className="text-gray-400 mb-2">Song Title:</p>
                <p className="text-white text-2xl font-bold mb-4">{tracks[currentIndex].name}</p>
                <Button 
                  onClick={() => {
                    if (currentIndex < tracks.length - 1) {
                      setCurrentIndex(currentIndex + 1)
                    } else {
                      router.push("/playlist")
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Next Song
                </Button>
              </div>
            </div>
          )}
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

        {/* Play button */}
        <div className="flex justify-center mb-8">
          <Button
            onClick={playSegment}
            size="lg"
            className="rounded-full w-20 h-20 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/25"
            disabled={isPlaying}
          >
            <Play className="w-8 h-8 fill-white" />
          </Button>
        </div>

        {/* Guess input */}
        <div className="space-y-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Know it? Search for the title"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleGuess()}
              className="bg-gray-800 border-gray-600 text-white text-lg h-12 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
            />
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
        />
      </div>
    </div>
  )
}

