"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Loader2, RotateCcw, Share2, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GameModal } from "@/components/game-modal"
import { GuessPanel, type GuessSuggestion } from "@/components/game/guess-panel"
import { LyricsCluePanel } from "@/components/game/lyrics-clue-panel"
import { PlaybackPanel } from "@/components/game/playback-panel"
import { ProgressPanel } from "@/components/game/progress-panel"
import { clearSavedGame, useGameState } from "@/hooks/use-game-state"
import {
  parseResolvedAudioSource,
  serializeResolvedAudioSource,
  useAudioPlayback,
} from "@/hooks/use-audio-playback"
import { useTracks } from "@/hooks/tracks-store"
import { useToast } from "@/hooks/use-toast"
import {
  captureProductEvent,
  getRunAnalyticsContext,
} from "@/lib/analytics"
import {
  completeDailyRun,
  EMPTY_DAILY_PROGRESS,
  readDailyProgress,
  type DailyProgressState,
} from "@/lib/daily-progress"
import { getTrackResultId } from "@/lib/game-state"
import {
  clearSavedGameModal,
  readSavedGameModal,
  writeSavedGameModal,
} from "@/lib/game-modal-state"
import {
  createRunId,
  isGenreSession,
  readGameSession,
  writeGameSession,
  type GameSessionMeta,
} from "@/lib/game-session"
import {
  completeGenreRun,
  EMPTY_GENRE_PROGRESS,
  readGenreProgress,
  selectGenrePracticeTracks,
  type GenreProgressRecord,
} from "@/lib/genre-progress"
import {
  dedupeGuessSuggestions,
  isCorrectGuess,
  isRelevantGuessSuggestion,
  normalizeGuessText,
  getGuessSuggestionSourcePriority,
} from "@/lib/guessing"
import { getGameNavigation, hasGameProgress } from "@/lib/game-navigation"
import { selectLyricsSnippetIndex } from "@/lib/lyrics-clues"
import { getYouTubeAudioCacheKey } from "@/lib/youtube"
import { fetchWithTimeout } from "@/lib/request-timeout"
import {
  getLyricsTrackId,
  readRecentLyricsTrackIds,
  rememberLyricsRun,
  selectLyricsRunTracks,
} from "@/lib/lyrics-runs"
import {
  buildRunShareText,
  copyShareText,
  resolveShareUrl,
} from "@/lib/sharing"
import type { GameMode, GameTrack } from "@/lib/tracks"

function getLocalTrackSuggestions(query: string, tracks: GameTrack[]): GuessSuggestion[] {
  const normalizedQuery = normalizeGuessText(query)
  if (normalizedQuery.length < 2) return []

  // Suggestions should reflect the playlist currently being played. The old
  // implementation searched the deprecated global curated catalog, which is
  // empty for dynamically loaded playlists and leaked unrelated answers.
  const searchPool = tracks

  return searchPool
    .map((track) => {
      const title = normalizeGuessText(track.name)
      const artists = normalizeGuessText(track.artists)
      const combined = `${artists} ${title}`.trim()
      const titleMatch = title.includes(normalizedQuery)
      const artistMatch = artists.includes(normalizedQuery)
      const combinedMatch = combined.includes(normalizedQuery)

      if (!titleMatch && !artistMatch && !combinedMatch) return null

      const suggestion = {
        uri: track.uri,
        name: track.name,
        artists: track.artists,
        albumImage: track.albumImage,
      }
      if (!isRelevantGuessSuggestion(query, suggestion)) return null

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
        suggestion,
      }
    })
    .filter((item): item is { score: number; suggestion: GuessSuggestion } => item !== null)
    .sort((a, b) => a.score - b.score || a.suggestion.name.localeCompare(b.suggestion.name))
    .slice(0, 6)
    .map((item) => item.suggestion)
}

function createReplayRunId(session: GameSessionMeta, firstTrack?: GameTrack) {
  if (session.playbackMode !== "lyrics" || !firstTrack) return createRunId("replay")

  const currentSnippet = selectLyricsSnippetIndex(firstTrack, session.runId)
  for (let attempt = 1; attempt <= 100; attempt++) {
    const candidate = `${session.runId}-replay-${attempt}`
    if (selectLyricsSnippetIndex(firstTrack, candidate) !== currentSnippet) return candidate
  }
  return createRunId("replay")
}

function createGenreReplay(
  session: GameSessionMeta & { kind: "genre"; genre: NonNullable<GameSessionMeta["genre"]> },
  currentTracks: GameTrack[]
) {
  const currentOrder = currentTracks.map((track) => track.uri).join("|")
  for (let attempt = 1; attempt <= 100; attempt++) {
    const runId = `${session.runId}-replay-${attempt}`
    const tracks = selectGenrePracticeTracks(session.genre, runId)
    if (tracks.map((track) => track.uri).join("|") !== currentOrder) {
      return { runId, tracks }
    }
  }

  const runId = createRunId("genre-replay")
  return { runId, tracks: selectGenrePracticeTracks(session.genre, runId) }
}

function createLyricsReplay(session: GameSessionMeta, currentTracks: GameTrack[]) {
  const currentOrder = currentTracks.map(getLyricsTrackId).join("|")
  const recentTrackIds = [
    ...readRecentLyricsTrackIds(localStorage),
    ...currentTracks.map(getLyricsTrackId),
  ]

  for (let attempt = 1; attempt <= 100; attempt++) {
    const runId = `${session.runId}-replay-${attempt}`
    const tracks = selectLyricsRunTracks({ runId, recentTrackIds })
    if (tracks.map(getLyricsTrackId).join("|") !== currentOrder) {
      return { runId, tracks }
    }
  }

  const runId = createRunId("lyrics-replay")
  return {
    runId,
    tracks: selectLyricsRunTracks({ runId, recentTrackIds }),
  }
}

type GameModalContent = {
  correct: boolean
  track: GameTrack | null
  guesses: string[]
  trackIndex: number
  pointsEarned: number
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

export default function GamePage() {
  const router = useRouter()
  const { toast } = useToast()
  const { tracks, setTracks, isLoading: tracksLoading } = useTracks()
  const [isLoading, setIsLoading] = useState(true)
  const [guess, setGuess] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [modalContent, setModalContent] = useState<GameModalContent | null>(null)
  const [suggestions, setSuggestions] = useState<GuessSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedUri, setSelectedUri] = useState<string | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<GuessSuggestion | null>(null)
  const [playlistComplete, setPlaylistComplete] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [session, setSession] = useState<GameSessionMeta | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [genreProgress, setGenreProgress] = useState<GenreProgressRecord>(EMPTY_GENRE_PROGRESS)
  const [dailyProgress, setDailyProgress] =
    useState<DailyProgressState>(EMPTY_DAILY_PROGRESS)
  const [isTrackTransitioning, setIsTrackTransitioning] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const youtubeContainerRef = useRef<HTMLDivElement>(null)
  const roundActionLockRef = useRef(false)
  const nextActionLockRef = useRef(false)
  const finalizeRunRef = useRef(false)
  const suggestionsAbortControllerRef = useRef<AbortController | null>(null)
  const suggestionsRequestIdRef = useRef(0)
  const [isRoundActionPending, setIsRoundActionPending] = useState(false)
  const [isNextPending, setIsNextPending] = useState(false)
  const gameMode: GameMode = session?.playbackMode ?? "audio"
  const dailyDate = session?.dateKey ?? null
  const isLyricsMode = gameMode === "lyrics"

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
    currentStreak,
    bestRunStreak,
    trackResults,
    recordCorrectGuess,
    recordFailedTrack,
    resetRound,
    resetGame,
    isStateHydrated,
    stageDurations,
    stageScores,
  } = useGameState({ tracks, tracksLoading, session })

  const currentTrack = tracks[currentIndex]
  const isTrackResolved = Boolean(
    currentTrack &&
      trackResults.some((result) => result.trackId === getTrackResultId(currentTrack))
  )
  const isRunComplete = playlistComplete || session?.status === "completed"
  const isRoundLocked =
    isRunComplete ||
    isRoundActionPending ||
    isNextPending ||
    isTrackTransitioning ||
    showModal ||
    isTrackResolved
  const navigation = getGameNavigation(session)

  const playback = useAudioPlayback({
    currentTrack: isLyricsMode ? undefined : currentTrack,
    currentStage,
    stageDurations,
    youtubeContainerRef,
  })

  useEffect(() => {
    const nextSession = readGameSession(localStorage)
    setSession(nextSession)
    setPlaylistComplete(nextSession?.status === "completed")
    if (isGenreSession(nextSession)) {
      setGenreProgress(readGenreProgress(localStorage, nextSession.genre))
    }
    if (nextSession?.kind === "daily") {
      setDailyProgress(readDailyProgress(localStorage))
    }
    setSessionLoaded(true)
  }, [])

  useEffect(() => {
    if (!session || !sessionLoaded || tracksLoading || tracks.length === 0 || !isStateHydrated) return

    const savedModal = readSavedGameModal(localStorage, session)
    if (!savedModal) return

    const savedTrack = tracks[savedModal.trackIndex]
    const savedResult = trackResults.find((result) => result.trackId === savedModal.trackId)
    const expectedStatus = savedModal.correct ? "solved" : "failed"
    if (
      !savedTrack ||
      getTrackResultId(savedTrack) !== savedModal.trackId ||
      !savedResult ||
      savedResult.status !== expectedStatus ||
      savedResult.points !== savedModal.pointsEarned ||
      savedResult.attempts.length !== savedModal.guesses.length
    ) {
      clearSavedGameModal(localStorage, session)
      return
    }

    setModalContent({
      ...savedModal,
      track: savedTrack,
    })
    setShowModal(true)
  }, [isStateHydrated, session, sessionLoaded, trackResults, tracks, tracksLoading])

  useEffect(() => {
    if (tracksLoading || !sessionLoaded) return
    if (tracks.length === 0) {
      router.push("/playlist")
      return
    }
    setIsLoading(false)
  }, [router, sessionLoaded, tracks.length, tracksLoading])

  const cancelSearchSuggestions = useCallback(() => {
    suggestionsRequestIdRef.current += 1
    suggestionsAbortControllerRef.current?.abort()
    suggestionsAbortControllerRef.current = null
    setIsSearching(false)
  }, [])

  const fetchSearchSuggestions = useCallback(
    async (query: string) => {
      const requestId = ++suggestionsRequestIdRef.current
      suggestionsAbortControllerRef.current?.abort()

      if (!query.trim()) {
        suggestionsAbortControllerRef.current = null
        setSuggestions([])
        setIsSearching(false)
        return
      }

      const controller = new AbortController()
      suggestionsAbortControllerRef.current = controller
      const localSuggestions = dedupeGuessSuggestions(getLocalTrackSuggestions(query, tracks))
      setSuggestions(localSuggestions)
      setIsSearching(true)

      try {
        if (localSuggestions.length >= 6) return

        const response = await fetchWithTimeout(
          `/api/youtube/suggestions?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
          10_000
        )

        if (requestId !== suggestionsRequestIdRef.current || controller.signal.aborted) return

        if (response.ok) {
          const data = await response.json()
          const externalSuggestions = dedupeGuessSuggestions(
            (Array.isArray(data) ? data : [])
              .filter((suggestion: GuessSuggestion) =>
                Boolean(suggestion?.uri) && isRelevantGuessSuggestion(query, suggestion)
              )
              .sort(
                (left: GuessSuggestion, right: GuessSuggestion) =>
                  getGuessSuggestionSourcePriority(right) - getGuessSuggestionSourcePriority(left)
              )
          ).slice(0, Math.max(0, 6 - localSuggestions.length))
          setSuggestions(
            dedupeGuessSuggestions([...localSuggestions, ...externalSuggestions]).slice(0, 6)
          )
        }
      } catch (error) {
        if (controller.signal.aborted || requestId !== suggestionsRequestIdRef.current) return
        console.warn("Search failed:", error)
      } finally {
        if (requestId === suggestionsRequestIdRef.current) {
          setIsSearching(false)
          if (suggestionsAbortControllerRef.current === controller) {
            suggestionsAbortControllerRef.current = null
          }
        }
      }
    },
    [gameMode, tracks]
  )

  useEffect(() => {
    cancelSearchSuggestions()
    if (selectedUri) return
    const timeout = setTimeout(() => {
      if (guess.trim().length > 2) {
        void fetchSearchSuggestions(guess)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 500)

    return () => {
      clearTimeout(timeout)
      cancelSearchSuggestions()
    }
  }, [cancelSearchSuggestions, fetchSearchSuggestions, guess, selectedUri])

  useEffect(() => {
    cancelSearchSuggestions()
    setSuggestions([])
    setShowSuggestions(false)
  }, [cancelSearchSuggestions, currentIndex])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  // Background pre-fetching for the next track
  useEffect(() => {
    if (gameMode !== "audio") return
    if (tracksLoading || tracks.length === 0) return
    const nextIndex = currentIndex + 1
    if (nextIndex >= tracks.length) return

    const nextTrack = tracks[nextIndex]
    if (!nextTrack || nextTrack.preview_url) return

    // If it's a YouTube track, it already has videoId or can be derived, no need to search
    if (nextTrack.source === "youtube") return

    const cacheKey = getYouTubeAudioCacheKey(nextTrack.uri)
    const cachedRaw = localStorage.getItem(cacheKey)
    const cachedSource = cachedRaw ? parseResolvedAudioSource(cachedRaw, nextTrack) : null

    if (cachedSource) return // Already cached with a full, parseable source
    if (cachedRaw) {
      try {
        localStorage.removeItem(cacheKey)
      } catch {
        // Cache invalidation is best effort.
      }
    }

    const prefetchNextTrack = async () => {
      try {
        const response = await fetchWithTimeout(
          `/api/youtube/search?title=${encodeURIComponent(nextTrack.name)}&artists=${encodeURIComponent(nextTrack.artists)}`,
          {},
          10_000
        )
        if (response.ok) {
          const data = await response.json()
          const resolvedSource = parseResolvedAudioSource(data, nextTrack)
          if (resolvedSource && (nextTrack.dailyEligible !== true || resolvedSource.audioStartVerified)) {
            localStorage.setItem(cacheKey, serializeResolvedAudioSource(resolvedSource))
          }
        }
      } catch (err) {
        console.warn("Background prefetch failed for:", nextTrack.name, err)
      }
    }

    // Delay prefetch slightly to let the current track playback load first
    const delayTimeout = setTimeout(() => {
      void prefetchNextTrack()
    }, 2000)

    return () => clearTimeout(delayTimeout)
  }, [currentIndex, gameMode, tracks, tracksLoading])

  const resetInput = () => {
    setGuess("")
    setSelectedUri(null)
    setSelectedSuggestion(null)
    setShowSuggestions(false)
  }

  const stopRoundPlayback = async () => {
    if (isLyricsMode) return
    playback.resetPlayback()
    await playback.pauseCurrentPlayback()
  }

  const handleGuess = async () => {
    if (
      !guess.trim() ||
      !currentTrack ||
      isRunComplete ||
      showModal ||
      isTrackResolved ||
      roundActionLockRef.current
    ) {
      return
    }

    roundActionLockRef.current = true
    setIsRoundActionPending(true)

    try {
      await stopRoundPlayback()

      const newGuesses = [...guesses, guess]
      setGuesses(newGuesses)
      const correctGuess = isCorrectGuess({
        guess,
        target: currentTrack,
        selectedUri,
        selectedSuggestion,
      })
      if (session) {
        captureProductEvent({
          name: "guess_submitted",
          properties: {
            ...getRunAnalyticsContext(session),
            trackNumber: currentIndex + 1,
            stage: currentStage + 1,
            correct: correctGuess,
          },
        })
      }

      if (correctGuess) {
        recordCorrectGuess(currentStage, currentTrack, newGuesses)
        if (session) {
          captureProductEvent({
            name: "track_completed",
            properties: {
              ...getRunAnalyticsContext(session),
              trackNumber: currentIndex + 1,
              stage: currentStage + 1,
              solved: true,
              score: stageScores[currentStage] || 0,
            },
          })
        }
        const nextModal = {
          correct: true,
          trackId: getTrackResultId(currentTrack),
          guesses: newGuesses,
          trackIndex: currentIndex,
          pointsEarned: stageScores[currentStage] || 0,
        }
        if (session) writeSavedGameModal(localStorage, session, nextModal)
        setModalContent({ ...nextModal, track: currentTrack })
        setShowModal(true)
      } else if (currentStage < 5) {
        if (session) {
          captureProductEvent({
            name: "clue_advanced",
            properties: {
              ...getRunAnalyticsContext(session),
              trackNumber: currentIndex + 1,
              stage: currentStage + 2,
              reason: "wrong",
            },
          })
        }
        setCurrentStage(currentStage + 1)
      } else {
        recordFailedTrack(currentTrack, newGuesses, currentStage)
        if (session) {
          captureProductEvent({
            name: "track_completed",
            properties: {
              ...getRunAnalyticsContext(session),
              trackNumber: currentIndex + 1,
              stage: currentStage + 1,
              solved: false,
              score: 0,
            },
          })
        }
        const nextModal = {
          correct: false,
          trackId: getTrackResultId(currentTrack),
          guesses: newGuesses,
          trackIndex: currentIndex,
          pointsEarned: 0,
        }
        if (session) writeSavedGameModal(localStorage, session, nextModal)
        setModalContent({ ...nextModal, track: currentTrack })
        setShowModal(true)
      }

      resetInput()
    } finally {
      roundActionLockRef.current = false
      setIsRoundActionPending(false)
    }
  }

  const handleSkip = async () => {
    if (
      !currentTrack ||
      isRunComplete ||
      showModal ||
      isTrackResolved ||
      roundActionLockRef.current
    ) {
      return
    }

    roundActionLockRef.current = true
    setIsRoundActionPending(true)

    try {
      await stopRoundPlayback()

      const newGuesses = [...guesses, "SKIPPED"]
      setGuesses(newGuesses)

      if (currentStage < 5) {
        if (session) {
          captureProductEvent({
            name: "clue_advanced",
            properties: {
              ...getRunAnalyticsContext(session),
              trackNumber: currentIndex + 1,
              stage: currentStage + 2,
              reason: "skip",
            },
          })
        }
        setCurrentStage(currentStage + 1)
      } else {
        recordFailedTrack(currentTrack, newGuesses, currentStage)
        if (session) {
          captureProductEvent({
            name: "track_completed",
            properties: {
              ...getRunAnalyticsContext(session),
              trackNumber: currentIndex + 1,
              stage: currentStage + 1,
              solved: false,
              score: 0,
            },
          })
        }
        const nextModal = {
          correct: false,
          trackId: getTrackResultId(currentTrack),
          guesses: newGuesses,
          trackIndex: currentIndex,
          pointsEarned: 0,
        }
        if (session) writeSavedGameModal(localStorage, session, nextModal)
        setModalContent({ ...nextModal, track: currentTrack })
        setShowModal(true)
      }

      resetInput()
    } finally {
      roundActionLockRef.current = false
      setIsRoundActionPending(false)
    }
  }

  const handleNextSong = async () => {
    if (!showModal || nextActionLockRef.current || isRunComplete) return

    nextActionLockRef.current = true
    setIsNextPending(true)

    try {
      clearSavedGameModal(localStorage, session)
      setShowModal(false)
      setModalContent(null)
      setIsTrackTransitioning(true)
      await waitForNextPaint()
      await playback.disposeCurrentPlayback()

      if (currentIndex < tracks.length - 1) {
        setCurrentIndex(currentIndex + 1)
        resetRound()
        return
      }

      if (finalizeRunRef.current) return
      finalizeRunRef.current = true
      resetRound()

      if (isGenreSession(session)) {
        setGenreProgress(
          completeGenreRun(localStorage, session.genre, {
            score,
            bestStreak: bestRunStreak,
            solved: correctCount,
          })
        )
      }
      if (session?.kind === "daily" && session.dateKey) {
        setDailyProgress(
          completeDailyRun(localStorage, {
            dateKey: session.dateKey,
            score,
            solved: correctCount,
            results: trackResults,
            runId: session.runId,
          })
        )
      }
      if (session) {
        const startedAt = session.startedAt
          ? new Date(session.startedAt).getTime()
          : Number.NaN
        const durationMs = Number.isFinite(startedAt)
          ? Math.max(0, Date.now() - startedAt)
          : undefined
        captureProductEvent({
          name: "run_completed",
          properties: {
            ...getRunAnalyticsContext(session),
            totalTracks: tracks.length,
            solvedCount: correctCount,
            score,
            ...(durationMs === undefined ? {} : { durationMs }),
          },
        })
        const completedSession = writeGameSession(localStorage, {
          ...session,
          status: "completed",
        })
        setSession(completedSession)
      }
      setPlaylistComplete(true)
    } finally {
      nextActionLockRef.current = false
      setIsNextPending(false)
      setIsTrackTransitioning(false)
    }
  }

  const exitRun = () => {
    if (session) {
      captureProductEvent({
        name: "run_abandoned",
        properties: {
          ...getRunAnalyticsContext(session),
          trackNumber: currentIndex + 1,
          stage: currentStage + 1,
        },
      })
    }
    playback.resetPlayback()
    clearSavedGameModal(localStorage, session)
    clearSavedGame(session)
    router.push(navigation.exitRoute)
  }

  const requestExitRun = () => {
    if (
      hasGameProgress({
        currentIndex,
        currentStage,
        guesses,
        score,
        correctCount,
      })
    ) {
      setShowExitConfirm(true)
      return
    }
    exitRun()
  }

  const handleSummaryExit = () => {
    playback.resetPlayback()
    clearSavedGameModal(localStorage, session)
    clearSavedGame(session)
    router.push(navigation.secondaryRoute)
  }

  const handleReplayPlaylist = async () => {
    await stopRoundPlayback()
    clearSavedGameModal(localStorage, session)
    if (session) {
      const genreReplay = isGenreSession(session) ? createGenreReplay(session, tracks) : null
      const lyricsReplay =
        session.kind === "lyrics" ? createLyricsReplay(session, tracks) : null
      const runId =
        genreReplay?.runId ??
        lyricsReplay?.runId ??
        createReplayRunId(session, tracks[0])
      const nextSession = writeGameSession(localStorage, {
        ...session,
        runId,
        startedAt: new Date().toISOString(),
        status: "active",
      })
      if (genreReplay) {
        setTracks(genreReplay.tracks)
      } else if (lyricsReplay) {
        setTracks(lyricsReplay.tracks)
        rememberLyricsRun(localStorage, lyricsReplay.tracks)
      }
      setSession(nextSession)
    }
    resetGame()
    finalizeRunRef.current = false
    setPlaylistComplete(false)
  }

  const handleLoadAnotherPlaylist = () => {
    playback.resetPlayback()
    clearSavedGameModal(localStorage, session)
    clearSavedGame(session)
    router.push(navigation.secondaryRoute)
  }

  const handleShareRun = async () => {
    if (!session) return

    try {
      const appUrl = resolveShareUrl(
        process.env.NEXT_PUBLIC_APP_URL,
        window.location.origin
      )
      const shareText = buildRunShareText({
        kind: session.kind,
        dateKey: session.dateKey,
        score,
        solved: correctCount,
        totalTracks: tracks.length,
        bestRunStreak,
        results: trackResults,
        appUrl,
      })
      await copyShareText(navigator.clipboard, shareText)
      captureProductEvent({
        name: "result_shared",
        properties: {
          ...getRunAnalyticsContext(session),
          scope: "run",
          success: true,
        },
      })
      toast({
        title: "Run copied!",
        description: "Your complete result is ready to share.",
      })
    } catch (error) {
      if (session) {
        captureProductEvent({
          name: "result_shared",
          properties: {
            ...getRunAnalyticsContext(session),
            scope: "run",
            success: false,
          },
        })
      }
      console.error("Failed to copy run result:", error)
      toast({
        title: "Copy failed",
        description: "Clipboard access failed. Try sharing the run again.",
        variant: "destructive",
      })
    }
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
      <div key="game-loading" className="min-h-screen bg-[#030712] text-gray-100 flex items-center justify-center relative overflow-hidden font-sans">
        <Loader2 className="w-10 h-10 text-green-400 animate-spin mx-auto mb-4" />
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div key="game-empty" className="min-h-screen bg-[#030712] text-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-gray-900/40 p-8 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Tracks Loaded</h2>
          <Button onClick={() => router.push("/playlist")} className="w-full h-12">Back to Playlist</Button>
        </div>
      </div>
    )
  }

  if (isRunComplete) {
    const averageStage = correctCount > 0 ? (solvedStageTotal / correctCount).toFixed(1) : "-"
    const maxScore = tracks.length * stageScores[0]
    const accuracy = tracks.length > 0 ? Math.round((correctCount / tracks.length) * 100) : 0
    const completeLabel = dailyDate
      ? "Daily Complete"
      : isGenreSession(session)
        ? "Genre Practice Complete"
        : isLyricsMode
          ? "Lyrics Complete"
          : "Playlist Complete"
    const completeModeLabel = dailyDate
      ? "Daily Challenge"
      : isGenreSession(session)
        ? `${session.genre.toUpperCase()} Practice`
        : isLyricsMode
          ? "Partial Lyrics Mode"
          : "Audio Playlist Mode"

    return (
      <div
        key="game-complete"
        className="min-h-screen bg-[#020617] text-[#dce5d9] flex items-center justify-center p-4 sm:p-6 font-sans"
        style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      >
        <div className="w-full max-w-xl bg-[#090d16]/70 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl ring-1 ring-white/5">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Button onClick={handleSummaryExit} variant="outline" size="sm" className="bg-transparent border-white/10 text-[#dce5d9] hover:bg-white/5 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {navigation.secondaryLabel}
            </Button>
            <div className="rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#10b981]">
              Mode: {completeModeLabel}
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center mb-4">
              <Trophy className="w-9 h-9 text-[#10b981]" />
            </div>
            <p className="font-display text-xs font-semibold text-[#10b981] uppercase tracking-widest mb-2">{completeLabel}</p>
            <h2 className="text-3xl font-extrabold text-white font-display">Final Score</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Score with performance label */}
            <div className="col-span-2 bg-[#10b981]/10 border border-[#10b981]/25 rounded-xl p-5 text-center">
              <p className="text-[10px] text-[#10b981] uppercase tracking-wide font-semibold">Score</p>
              <p className="text-4xl font-extrabold text-white">{score}</p>
              <p className="text-xs text-[#9ca3af] mt-1">
                {accuracy === 100
                  ? "🏆 Perfect — solved every track!"
                  : accuracy >= 80
                  ? "🔥 Great job!"
                  : accuracy >= 50
                  ? "👍 Nice try!"
                  : "💪 Keep practicing!"}
              </p>
            </div>

            {/* Solved */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Solved</p>
              <p className="text-2xl font-extrabold text-white">{correctCount} / {tracks.length}</p>
            </div>

            {/* Accuracy */}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">Accuracy</p>
              <p className="text-2xl font-extrabold text-white">{accuracy}%</p>
            </div>

            {isGenreSession(session) && (
              <>
                <div className="bg-cyan-400/[0.06] border border-cyan-300/15 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-cyan-300 uppercase tracking-wide font-semibold">Run Streak</p>
                  <p className="text-2xl font-extrabold text-white">{bestRunStreak}</p>
                </div>
                <div className="bg-cyan-400/[0.06] border border-cyan-300/15 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-cyan-300 uppercase tracking-wide font-semibold">Best Score</p>
                  <p className="text-2xl font-extrabold text-white">{genreProgress.bestScore}</p>
                </div>
              </>
            )}

            {session?.kind === "daily" && (
              <>
                <div className="bg-amber-300/[0.06] border border-amber-200/15 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-amber-200 uppercase tracking-wide font-semibold">Daily Streak</p>
                  <p className="text-2xl font-extrabold text-white">{dailyProgress.currentStreak}</p>
                </div>
                <div className="bg-amber-300/[0.06] border border-amber-200/15 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-amber-200 uppercase tracking-wide font-semibold">Best Streak</p>
                  <p className="text-2xl font-extrabold text-white">{dailyProgress.bestStreak}</p>
                </div>
              </>
            )}

            {/* Average clip heard — how quickly they got it on average */}
            {correctCount > 0 && (() => {
              const STAGE_DURATIONS_S = [0.5, 1, 2, 4, 8, 15]
              const avgStageIdx = correctCount > 0 ? (solvedStageTotal / correctCount) - 1 : 0
              const clampedIdx = Math.max(0, Math.min(5, Math.round(avgStageIdx)))
              const avgClip = STAGE_DURATIONS_S[clampedIdx]
              return (
                <div className="col-span-2 bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">
                    {isLyricsMode ? "Avg. Clue Level to Solve" : "Avg. Clip Heard to Solve"}
                  </p>
                  <p className="text-2xl font-extrabold text-white">{isLyricsMode ? averageStage : `${avgClip}s`}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {isLyricsMode
                      ? "Lower is better."
                      : avgClip <= 0.5 ? "Instant recognition — legendary!" : avgClip <= 1 ? "Very fast!" : avgClip <= 2 ? "Solid!" : avgClip <= 4 ? "Getting there" : "Needed some hints"}
                  </p>
                </div>
              )
            })()}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => void handleShareRun()}
              className="h-12 w-full rounded-xl bg-[#10b981] font-bold text-black hover:bg-[#34d399]"
            >
              <Share2 className="mr-2 h-4 w-4" />
              SHARE RUN
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleReplayPlaylist} className="flex-1 bg-[#10b981] hover:bg-[#10b981]/90 text-black font-bold h-12 rounded-xl">
              <RotateCcw className="w-4 h-4 mr-2" />
              {navigation.replayLabel}
            </Button>
            <Button onClick={handleLoadAnotherPlaylist} variant="outline" className="flex-1 bg-transparent border-white/10 hover:bg-white/5 text-[#dce5d9] h-12 rounded-xl">
              {navigation.secondaryLabel}
            </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentIndex >= tracks.length) {
    return null
  }

  const activeModeLabel = dailyDate
    ? "Daily Challenge"
    : isGenreSession(session)
      ? `${session.genre.toUpperCase()} Practice`
      : isLyricsMode
        ? "Partial Lyrics Mode"
        : "Audio Playlist Mode"
  const activeModeDetail = dailyDate
    ? dailyDate
    : isGenreSession(session)
      ? `${currentStreak} current streak`
      : isLyricsMode
        ? "Lyrics clues"
        : "Audio clips"

  return (
    <div
      key="game-active"
      className="min-h-screen bg-[#020617] text-[#dce5d9] flex flex-col relative overflow-hidden font-sans p-4 sm:p-6 md:p-8"
      style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
    >
      {!isLyricsMode && (
        <div
          ref={youtubeContainerRef}
          data-testid="youtube-player-host"
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: "fixed",
            left: "-10000px",
            top: "-10000px",
            width: "1px",
            height: "1px",
            overflow: "hidden",
            clipPath: "inset(50%)",
            opacity: 0,
            pointerEvents: "none",
            zIndex: 0,
            contain: "strict",
          }}
        />
      )}

      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#10b981]/5 blur-[150px] pointer-events-none" />

      <div className="max-w-2xl mx-auto w-full relative z-10 flex-1 flex flex-col justify-center py-4">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#10b981] via-emerald-400 to-[#10b981] bg-clip-text text-transparent">
                Songless<span className="text-white font-light">Unlimited</span>
              </h1>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#10b981]">
                Mode: {activeModeLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                {activeModeDetail}
              </span>
            </div>
          </div>
          <Button onClick={requestExitRun} variant="outline" size="sm" className="bg-transparent border-white/10 text-[#9ca3af] hover:bg-white/5 hover:text-white sm:mt-1">
            <X className="w-4 h-4 mr-1.5" /> {navigation.exitLabel}
          </Button>
        </div>

        <ProgressPanel
          currentIndex={currentIndex}
          totalTracks={tracks.length}
          currentStage={currentStage}
          stageDurations={stageDurations}
          progress={isLyricsMode ? 100 : playback.progress}
          isPlaying={isLyricsMode ? false : playback.isPlaying}
          score={score}
          correctCount={correctCount}
          mode={gameMode}
        />

        {isLyricsMode && currentTrack ? (
          <LyricsCluePanel
            track={currentTrack}
            currentStage={currentStage}
            snippetIndex={selectLyricsSnippetIndex(currentTrack, session?.runId ?? session?.id ?? "lyrics")}
          />
        ) : (
          <PlaybackPanel
            progress={playback.progress}
            isPlayerReady={playback.isPlayerReady}
            isResolvingAudio={playback.isResolvingAudio}
            loadingStep={playback.loadingStep}
            playbackError={playback.playbackError}
            canRetryAudio={playback.canRetryAudio}
            isRetryingAudio={playback.isRetryingAudio}
            isPlaying={playback.isPlaying}
            isPaused={playback.isPaused}
            onPlay={handlePlay}
            onPause={() => void playback.pause()}
            onResume={() => void playback.resume()}
            onRetry={async () => {
              if (session) {
                captureProductEvent({
                  name: "audio_retry",
                  properties: {
                    ...getRunAnalyticsContext(session),
                    trackNumber: currentIndex + 1,
                    outcome: "requested",
                  },
                })
              }
              const retried = await playback.retryAudioSource()
              if (session) {
                captureProductEvent({
                  name: "audio_retry",
                  properties: {
                    ...getRunAnalyticsContext(session),
                    trackNumber: currentIndex + 1,
                    success: retried,
                    outcome: retried ? "succeeded" : "exhausted",
                  },
                })
              }
            }}
          />
        )}

        <GuessPanel
          guess={guess}
          guesses={guesses}
          currentStage={currentStage}
          stageDurations={stageDurations}
          suggestions={suggestions}
          isSearching={isSearching}
          showSuggestions={showSuggestions}
          isDisabled={isRoundLocked}
          searchContainerRef={searchContainerRef}
          onGuessChange={(value) => {
            setGuess(value)
            setSelectedUri(null)
            setSelectedSuggestion(null)
          }}
          onFocus={() => setShowSuggestions(true)}
          onSelectSuggestion={(suggestion) => {
            cancelSearchSuggestions()
            setGuess(`${suggestion.artists} - ${suggestion.name}`)
            setSelectedUri(suggestion.uri)
            setSelectedSuggestion(suggestion)
            setShowSuggestions(false)
          }}
          onSubmitGuess={() => {
            setShowSuggestions(false)
            cancelSearchSuggestions()
            void handleGuess()
          }}
          onDismissSuggestions={() => {
            setShowSuggestions(false)
            cancelSearchSuggestions()
          }}
          onSkip={() => void handleSkip()}
          mode={gameMode}
        />

        {showModal && modalContent && !isTrackTransitioning && (
          <GameModal
            isOpen
            correct={modalContent.correct}
            track={modalContent.track}
            onNext={handleNextSong}
            isNextPending={isNextPending}
            onBack={() => {
              requestExitRun()
            }}
            backLabel={navigation.exitLabel}
            guesses={modalContent.guesses}
            trackIndex={modalContent.trackIndex}
            pointsEarned={modalContent.pointsEarned}
            nextLabel={modalContent.trackIndex === tracks.length - 1 ? "VIEW SUMMARY" : "NEXT SONG"}
            mode={gameMode}
            dailyDate={dailyDate}
            score={score}
            session={session}
          />
        )}

        <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
          <AlertDialogContent className="border-white/10 bg-[#090d16] text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Exit and discard this run?</AlertDialogTitle>
              <AlertDialogDescription className="text-[#9ca3af]">
                Your current guesses, score, and track progress will be cleared.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 bg-transparent text-white hover:bg-white/5 hover:text-white">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={exitRun}
                className="bg-[#ef4444] text-white hover:bg-[#dc2626]"
              >
                Exit and discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
