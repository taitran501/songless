"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, RotateCcw, Trophy, X } from "lucide-react"
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
import { isYoutubeTrack, type GameTrack } from "@/lib/tracks"

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getLocalTrackSuggestions(query: string, tracks: GameTrack[]): GuessSuggestion[] {
  const normalizedQuery = normalizeSearchText(query)
  if (normalizedQuery.length < 2) return []

  return tracks
    .map((track) => {
      const title = normalizeSearchText(track.name)
      const artists = normalizeSearchText(track.artists)
      const combined = `${artists} ${title}`.trim()
      const titleMatch = title.includes(normalizedQuery)
      const artistMatch = artists.includes(normalizedQuery)
      const combinedMatch = combined.includes(normalizedQuery)

      if (!titleMatch && !artistMatch && !combinedMatch) return null

      const score =
        title === normalizedQuery
          ? 0
          : title.startsWith(normalizedQuery)
            ? 1
            : titleMatch
              ? 2
              : artistMatch
                ? 3
                : 4

      return {
        score,
        suggestion: {
          uri: track.uri,
          name: track.name,
          artists: track.artists,
          albumImage: track.albumImage,
        },
      }
    })
    .filter((item): item is { score: number; suggestion: GuessSuggestion } => item !== null)
    .sort((a, b) => a.score - b.score || a.suggestion.name.localeCompare(b.suggestion.name))
    .slice(0, 6)
    .map((item) => item.suggestion)
}

export default function GamePage() {
  const router = useRouter()
  const { toast } = useToast()
  const { tracks, isLoading: tracksLoading } = useTracks()
  const { accessToken, isLoading: authLoading } = useSpotifyAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [guess, setGuess] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [modalContent, setModalContent] = useState<{
    correct: boolean
    track: GameTrack | null
    guesses: string[]
    trackIndex: number
    pointsEarned: number
  }>({ correct: false, track: null, guesses: [], trackIndex: 0, pointsEarned: 0 })
  const [suggestions, setSuggestions] = useState<GuessSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedUri, setSelectedUri] = useState<string | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<GuessSuggestion | null>(null)
  const [playlistComplete, setPlaylistComplete] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const {
    currentIndex,
    setCurrentIndex,
    currentStage,
    setCurrentStage,
    guesses,
    setGuesses,
    score,
    correctCount,
    solvedStageTotal,
    recordCorrectGuess,
    resetRound,
    resetGame,
    stageDurations,
    stageScores,
  } = useGameState({ tracks, tracksLoading })

  const currentTrack = tracks[currentIndex]

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
    setIsLoading(false)
  }, [authLoading, router, tracks.length, tracksLoading])

  const fetchSearchSuggestions = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSuggestions([])
        return
      }

      setIsSearching(true)
      try {
        const useSpotifySearch = Boolean(accessToken && currentTrack && !isYoutubeTrack(currentTrack))
        const localSuggestions = useSpotifySearch ? [] : getLocalTrackSuggestions(query, tracks)

        if (localSuggestions.length >= 4) {
          setSuggestions(localSuggestions)
          return
        }

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
            const seen = new Set(localSuggestions.map((suggestion) => suggestion.uri))
            const externalSuggestions = (Array.isArray(data) ? data : [])
              .filter((suggestion: GuessSuggestion) => {
                if (!suggestion?.uri || seen.has(suggestion.uri)) return false
                seen.add(suggestion.uri)
                return true
              })
              .slice(0, Math.max(0, 6 - localSuggestions.length))
            setSuggestions([...localSuggestions, ...externalSuggestions])
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
    [accessToken, currentTrack, tracks]
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

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  const resetInput = () => {
    setGuess("")
    setSelectedUri(null)
    setSelectedSuggestion(null)
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

    if (isCorrectGuess({ guess, target: currentTrack, selectedUri, selectedSuggestion })) {
      recordCorrectGuess(currentStage)
      setModalContent({
        correct: true,
        track: currentTrack,
        guesses: newGuesses,
        trackIndex: currentIndex,
        pointsEarned: stageScores[currentStage] || 0,
      })
      setShowModal(true)
    } else if (currentStage < 5) {
      setCurrentStage(currentStage + 1)
    } else {
      setModalContent({
        correct: false,
        track: currentTrack,
        guesses: newGuesses,
        trackIndex: currentIndex,
        pointsEarned: 0,
      })
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
      setModalContent({
        correct: false,
        track: currentTrack,
        guesses: newGuesses,
        trackIndex: currentIndex,
        pointsEarned: 0,
      })
      setShowModal(true)
    }

    resetInput()
  }

  const handleNextSong = async () => {
    setShowModal(false)
    await stopRoundPlayback()

    if (currentIndex < tracks.length - 1) {
      window.setTimeout(() => {
        setCurrentIndex(currentIndex + 1)
        resetRound()
      }, 220)
      return
    }

    window.setTimeout(() => {
      resetRound()
      setPlaylistComplete(true)
    }, 220)
  }

  const handleExitPlaylist = () => {
    playback.resetPlayback()
    clearSavedGame()
    router.push("/playlist")
  }

  const handleReplayPlaylist = async () => {
    await stopRoundPlayback()
    resetGame()
    setPlaylistComplete(false)
  }

  const handleLoadAnotherPlaylist = () => {
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

  if (playlistComplete) {
    const averageStage = correctCount > 0 ? (solvedStageTotal / correctCount).toFixed(1) : "-"
    const maxScore = tracks.length * stageScores[0]
    const accuracy = tracks.length > 0 ? Math.round((correctCount / tracks.length) * 100) : 0

    return (
      <div
        className="min-h-screen bg-[#020617] text-[#dce5d9] flex items-center justify-center p-4 sm:p-6 font-sans"
        style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      >
        <div className="w-full max-w-xl bg-[#090d16]/70 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl ring-1 ring-white/5">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center mb-4">
              <Trophy className="w-9 h-9 text-[#10b981]" />
            </div>
            <p className="font-display text-xs font-semibold text-[#10b981] uppercase tracking-widest mb-2">Playlist Complete</p>
            <h2 className="text-3xl font-extrabold text-white font-display">Final Score</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="col-span-2 bg-[#10b981]/10 border border-[#10b981]/25 rounded-xl p-5 text-center">
              <p className="text-[10px] text-[#10b981] uppercase tracking-wide font-semibold">Score</p>
              <p className="text-4xl font-extrabold text-white">{score}</p>
              <p className="text-xs text-[#9ca3af] mt-1">Max {maxScore}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Solved</p>
              <p className="text-2xl font-extrabold text-white">{correctCount} / {tracks.length}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Accuracy</p>
              <p className="text-2xl font-extrabold text-white">{accuracy}%</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Average Stage</p>
              <p className="text-2xl font-extrabold text-white">{averageStage}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Tracks</p>
              <p className="text-2xl font-extrabold text-white">{tracks.length}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReplayPlaylist} className="flex-1 bg-[#10b981] hover:bg-[#10b981]/90 text-black font-bold h-12 rounded-xl">
              <RotateCcw className="w-4 h-4 mr-2" />
              REPLAY PLAYLIST
            </Button>
            <Button onClick={handleLoadAnotherPlaylist} variant="outline" className="flex-1 bg-transparent border-white/10 hover:bg-white/5 text-[#dce5d9] h-12 rounded-xl">
              LOAD ANOTHER
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (currentIndex >= tracks.length) {
    return null
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
          score={score}
          correctCount={correctCount}
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
            setSelectedSuggestion(null)
          }}
          onFocus={() => setShowSuggestions(true)}
          onSelectSuggestion={(suggestion) => {
            setGuess(`${suggestion.artists} - ${suggestion.name}`)
            setSelectedUri(suggestion.uri)
            setSelectedSuggestion(suggestion)
            setShowSuggestions(false)
          }}
          onSubmitGuess={() => void handleGuess()}
          onSkip={() => void handleSkip()}
        />

        <GameModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          correct={modalContent.correct}
          track={modalContent.track}
          onNext={handleNextSong}
          onBack={() => {
            setShowModal(false)
            router.push("/playlist")
          }}
          guesses={modalContent.guesses}
          trackIndex={modalContent.trackIndex}
          pointsEarned={modalContent.pointsEarned}
          nextLabel={modalContent.trackIndex === tracks.length - 1 ? "VIEW SUMMARY" : "NEXT SONG"}
        />
      </div>
    </div>
  )
}
