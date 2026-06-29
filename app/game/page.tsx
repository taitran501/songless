"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GameModal } from "@/components/game-modal"
import { GuessPanel, type GuessSuggestion } from "@/components/game/guess-panel"
import { PlaybackPanel } from "@/components/game/playback-panel"
import { ProgressPanel } from "@/components/game/progress-panel"
import { clearSavedGame, useGameState } from "@/hooks/use-game-state"
import { useAudioPlayback } from "@/hooks/use-audio-playback"
import { useTracks } from "@/hooks/tracks-store"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"
import { useToast } from "@/hooks/use-toast"
import { isCorrectGuess } from "@/lib/guessing"
import { isSpotifyTrack, isYoutubeTrack } from "@/lib/tracks"

export default function GamePage() {
  const router = useRouter()
  const { toast } = useToast()
  const { tracks, isLoading: tracksLoading } = useTracks()
  const { accessToken, isLoading: authLoading } = useSpotifyAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [guess, setGuess] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [modalContent, setModalContent] = useState<{ correct: boolean; answer: string }>({ correct: false, answer: "" })
  const [suggestions, setSuggestions] = useState<GuessSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedUri, setSelectedUri] = useState<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const {
    currentIndex,
    setCurrentIndex,
    currentStage,
    setCurrentStage,
    guesses,
    setGuesses,
    resetRound,
    stageDurations,
  } = useGameState({ tracks, tracksLoading })

  const currentTrack = tracks[currentIndex]
  const hasSpotifyTracks = tracks.some(isSpotifyTrack)

  const playback = useAudioPlayback({
    currentTrack,
    currentStage,
    stageDurations,
  })

  useEffect(() => {
    if (authLoading || tracksLoading) return
    if (tracks.length === 0) {
      router.push("/playlist")
      return
    }
    if (hasSpotifyTracks && !accessToken) {
      router.push("/")
      return
    }
    setIsLoading(false)
  }, [accessToken, authLoading, hasSpotifyTracks, router, tracks.length, tracksLoading])

  const fetchSearchSuggestions = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSuggestions([])
        return
      }

      setIsSearching(true)
      try {
        const useSpotifySearch = Boolean(accessToken && currentTrack && !isYoutubeTrack(currentTrack))
        const response = useSpotifySearch
          ? await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=6`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
          : await fetch(`/api/youtube/suggestions?q=${encodeURIComponent(query)}`)

        if (response.ok) {
          const data = await response.json()
          if (useSpotifySearch) {
            const items = data.tracks?.items || []
            setSuggestions(
              items.map((item: any) => ({
                uri: item.uri,
                name: item.name,
                artists: item.artists.map((artist: any) => artist.name).join(", "),
                albumImage: item.album?.images?.[2]?.url || item.album?.images?.[0]?.url || null,
              }))
            )
          } else {
            setSuggestions(data)
          }
        } else {
          setSuggestions([])
        }
      } catch (error) {
        console.warn("Search failed:", error)
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    },
    [accessToken, currentTrack]
  )

  useEffect(() => {
    if (selectedUri) return
    const timeout = setTimeout(() => {
      if (guess.trim().length > 1) {
        void fetchSearchSuggestions(guess)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [fetchSearchSuggestions, guess, selectedUri])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const resetInput = () => {
    setGuess("")
    setSelectedUri(null)
    setShowSuggestions(false)
  }

  const stopRoundPlayback = async () => {
    playback.resetPlayback()
    await playback.pauseCurrentPlayback()
  }

  const handleGuess = async () => {
    if (!guess.trim() || !currentTrack) return
    await stopRoundPlayback()

    const newGuesses = [...guesses, guess]
    setGuesses(newGuesses)

    if (isCorrectGuess({ guess, target: currentTrack, selectedUri })) {
      setModalContent({ correct: true, answer: currentTrack.name })
      setShowModal(true)
    } else if (currentStage < 5) {
      setCurrentStage(currentStage + 1)
    } else {
      setModalContent({ correct: false, answer: currentTrack.name })
      setShowModal(true)
    }

    resetInput()
  }

  const handleSkip = async () => {
    if (!currentTrack) return
    await stopRoundPlayback()

    const newGuesses = [...guesses, "SKIPPED"]
    setGuesses(newGuesses)

    if (currentStage < 5) {
      setCurrentStage(currentStage + 1)
    } else {
      setModalContent({ correct: false, answer: currentTrack.name })
      setShowModal(true)
    }

    resetInput()
  }

  const handleNextSong = async () => {
    setShowModal(false)
    await stopRoundPlayback()

    if (currentIndex < tracks.length - 1) {
      setCurrentIndex(currentIndex + 1)
      resetRound()
      return
    }

    clearSavedGame()
    router.push("/playlist")
  }

  const handleExitPlaylist = () => {
    playback.resetPlayback()
    clearSavedGame()
    router.push("/playlist")
  }

  const handlePlay = async () => {
    const started = await playback.playSegment()
    if (!started) {
      toast({
        title: "Audio loading",
        description: "Still fetching audio source. Please wait a second and try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030712] text-gray-100 flex items-center justify-center relative overflow-hidden font-sans">
        <Loader2 className="w-10 h-10 text-green-400 animate-spin mx-auto mb-4" />
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="min-h-screen bg-[#030712] text-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-gray-900/40 p-8 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Tracks Loaded</h2>
          <Button onClick={() => router.push("/playlist")} className="w-full h-12">Back to Playlist</Button>
        </div>
      </div>
    )
  }

  if (currentIndex >= tracks.length) {
    return (
      <div className="min-h-screen bg-[#030712] text-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-gray-900/40 p-8 rounded-2xl">
          <Sparkles className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-3xl font-extrabold mb-2">Playlist Completed!</h2>
          <Button onClick={handleExitPlaylist} className="w-full h-12">Play Another</Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[#020617] text-[#dce5d9] flex flex-col relative overflow-hidden font-sans p-4 sm:p-6 md:p-8 select-none"
      style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          bottom: 0,
          width: "200px",
          height: "200px",
          opacity: 0.01,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div id="youtube-player"></div>
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#10b981]/5 blur-[150px] pointer-events-none" />

      <div className="max-w-2xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-center py-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#10b981] via-emerald-400 to-[#10b981] bg-clip-text text-transparent">
            Songless<span className="text-white font-light">Unlimited</span>
          </h1>
          <Button onClick={handleExitPlaylist} variant="outline" size="sm" className="bg-transparent border-white/10 text-[#9ca3af] hover:bg-white/5 hover:text-white">
            <X className="w-4 h-4 mr-1.5" /> Exit Game
          </Button>
        </div>

        <ProgressPanel
          currentIndex={currentIndex}
          totalTracks={tracks.length}
          currentStage={currentStage}
          stageDurations={stageDurations}
          progress={playback.progress}
          isPlaying={playback.isPlaying}
        />

        <PlaybackPanel
          isPlayerReady={playback.isPlayerReady}
          isResolvingAudio={playback.isResolvingAudio}
          playbackError={playback.playbackError}
          isPlaying={playback.isPlaying}
          isPaused={playback.isPaused}
          onPlay={handlePlay}
          onPause={() => void playback.pause()}
          onResume={() => void playback.resume()}
        />

        <GuessPanel
          guess={guess}
          guesses={guesses}
          currentStage={currentStage}
          stageDurations={stageDurations}
          suggestions={suggestions}
          isSearching={isSearching}
          showSuggestions={showSuggestions}
          searchContainerRef={searchContainerRef}
          onGuessChange={(value) => {
            setGuess(value)
            setSelectedUri(null)
          }}
          onFocus={() => setShowSuggestions(true)}
          onSelectSuggestion={(suggestion) => {
            setGuess(`${suggestion.artists} - ${suggestion.name}`)
            setSelectedUri(suggestion.uri)
            setShowSuggestions(false)
          }}
          onSubmitGuess={() => void handleGuess()}
          onSkip={() => void handleSkip()}
        />

        <GameModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          correct={modalContent.correct}
          track={currentTrack}
          onNext={handleNextSong}
          onBack={() => {
            setShowModal(false)
            router.push("/playlist")
          }}
          guesses={guesses}
          trackIndex={currentIndex}
        />
      </div>
    </div>
  )
}
