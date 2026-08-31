"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { AudioAnalysisStatus, GameTrack, TrackAudioSourceType } from "@/lib/tracks"
import { isYoutubeTrack } from "@/lib/tracks"
import { getYouTubeAudioCacheKey } from "@/lib/youtube"

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
    YT: any
  }
}

interface UseAudioPlaybackOptions {
  currentTrack?: GameTrack
  currentStage: number
  stageDurations: readonly number[]
  youtubeContainerRef: RefObject<HTMLDivElement | null>
}

const AUDIO_LOAD_TIMEOUT_MS = 10_000
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{6,32}$/
const AUDIO_SOURCE_TYPES: readonly TrackAudioSourceType[] = [
  "official_audio",
  "lyric_video",
  "music_video",
  "performance",
  "unknown",
]

export interface ResolvedAudioSource {
  videoId: string
  sourceType: TrackAudioSourceType
  rawTitle: string
  matchedTitle: string
  matchedArtists: string
  audioStartSeconds?: number
  audioFirstManifest?: boolean
  audioAnalysisStatus?: AudioAnalysisStatus
  audioStartVerified: boolean
}

function validAudioStart(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function isApprovedAudioStart(
  audioStartSeconds: number | undefined,
  audioAnalysisStatus: AudioAnalysisStatus | undefined,
  audioFirstManifest: boolean | undefined
) {
  return (
    audioAnalysisStatus === "approved" &&
    audioStartSeconds !== undefined &&
    (audioStartSeconds !== 0 || audioFirstManifest === true)
  )
}

export function createResolvedAudioSource(track: GameTrack, videoId: string): ResolvedAudioSource {
  const audioStartSeconds = validAudioStart(track.audioStartSeconds)
  return {
    videoId,
    sourceType: track.sourceType ?? "unknown",
    rawTitle: `${track.artists} - ${track.name}`,
    matchedTitle: track.name,
    matchedArtists: track.artists,
    ...(audioStartSeconds === undefined ? {} : { audioStartSeconds }),
    ...(track.audioFirstManifest === undefined
      ? {}
      : { audioFirstManifest: track.audioFirstManifest }),
    ...(track.audioAnalysisStatus === undefined
      ? {}
      : { audioAnalysisStatus: track.audioAnalysisStatus }),
    audioStartVerified: isApprovedAudioStart(
      audioStartSeconds,
      track.audioAnalysisStatus,
      track.audioFirstManifest
    ),
  }
}

export function parseResolvedAudioSource(
  raw: unknown,
  fallback: Pick<GameTrack, "name" | "artists">
): ResolvedAudioSource | null {
  let value = raw
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw)
    } catch {
      // A legacy cache stores only a video ID. It must be resolved again.
      return null
    }
  }
  if (!value || typeof value !== "object") return null

  const candidate = value as Record<string, unknown>
  const videoId = typeof candidate.videoId === "string" ? candidate.videoId : ""
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) return null

  const sourceType = AUDIO_SOURCE_TYPES.includes(candidate.sourceType as TrackAudioSourceType)
    ? (candidate.sourceType as TrackAudioSourceType)
    : "unknown"
  const audioStartSeconds = validAudioStart(candidate.audioStartSeconds)
  const audioAnalysisStatus =
    candidate.audioAnalysisStatus === "approved" ||
    candidate.audioAnalysisStatus === "needs_review" ||
    candidate.audioAnalysisStatus === "failed"
      ? candidate.audioAnalysisStatus
      : undefined
  const audioFirstManifest =
    typeof candidate.audioFirstManifest === "boolean" ? candidate.audioFirstManifest : undefined

  return {
    videoId,
    sourceType,
    rawTitle:
      typeof candidate.rawTitle === "string" && candidate.rawTitle.trim()
        ? candidate.rawTitle
        : `${fallback.artists} - ${fallback.name}`,
    matchedTitle:
      typeof candidate.matchedTitle === "string" && candidate.matchedTitle.trim()
        ? candidate.matchedTitle
        : fallback.name,
    matchedArtists:
      typeof candidate.matchedArtists === "string" && candidate.matchedArtists.trim()
        ? candidate.matchedArtists
        : fallback.artists,
    ...(audioStartSeconds === undefined ? {} : { audioStartSeconds }),
    ...(audioFirstManifest === undefined ? {} : { audioFirstManifest }),
    ...(audioAnalysisStatus === undefined ? {} : { audioAnalysisStatus }),
    audioStartVerified: isApprovedAudioStart(
      audioStartSeconds,
      audioAnalysisStatus,
      audioFirstManifest
    ),
  }
}

export function serializeResolvedAudioSource(source: ResolvedAudioSource) {
  return JSON.stringify(source)
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function getTrackPlaybackKey(track?: GameTrack) {
  if (!track) return null
  const videoId = track.videoId || (isYoutubeTrack(track) ? track.uri.replace(/^youtube:/, "") : "")
  return [track.uri, videoId].join("|")
}

export function useAudioPlayback({
  currentTrack,
  currentStage,
  stageDurations,
  youtubeContainerRef,
}: UseAudioPlaybackOptions) {
  const [progress, setProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [ytReady, setYtReady] = useState(false)
  const [ytPlayer, setYtPlayer] = useState<any>(null)
  const [ytPlayerKey, setYtPlayerKey] = useState<string | null>(null)
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [isResolvingAudio, setIsResolvingAudio] = useState(false)
  const [isRetryingAudio, setIsRetryingAudio] = useState(false)
  const [retryAvailable, setRetryAvailable] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string | null>(null)
  const [useYoutubeFallback, setUseYoutubeFallback] = useState(false)
  const [youtubeScriptAttempt, setYoutubeScriptAttempt] = useState(0)
  const [activeYoutubeSource, setActiveYoutubeSource] = useState<ResolvedAudioSource | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ytPlayerRef = useRef<any>(null)
  const ytPlayerKeyRef = useRef<string | null>(null)
  const youtubeVideoIdRef = useRef<string | null>(null)
  const youtubeResolveControllerRef = useRef<AbortController | null>(null)
  const youtubeRetryCountRef = useRef(0)
  const failedVideoIdsRef = useRef<Set<string>>(new Set())
  const youtubePlaybackFailedRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const playSessionIdRef = useRef(0)
  const playbackGenerationRef = useRef(0)
  const trackPlaybackKeyRef = useRef<string | null>(null)
  const youtubeMountRef = useRef<HTMLDivElement | null>(null)
  const activeYoutubeSourceRef = useRef<ResolvedAudioSource | null>(null)

  const updateActiveYoutubeSource = useCallback((source: ResolvedAudioSource | null) => {
    activeYoutubeSourceRef.current = source
    setActiveYoutubeSource(source)
  }, [])

  const needsYoutube =
    !!currentTrack && (!currentTrack.preview_url || useYoutubeFallback)
  const trackPlaybackKey = getTrackPlaybackKey(currentTrack)
  youtubeVideoIdRef.current = youtubeVideoId
  const isPlayerReady =
    !playbackError &&
    (!needsYoutube ||
      (youtubeVideoId !== null && ytPlayer !== null && ytPlayerKey === trackPlaybackKey))

  useEffect(() => {
    audioRef.current = new Audio()
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const destroyYoutubePlayer = useCallback(() => {
    const player = ytPlayerRef.current
    const mount = youtubeMountRef.current
    if (player) {
      try {
        player.stopVideo?.()
      } catch {
        // The player may already be gone during a route transition.
      }
      try {
        player.destroy?.()
      } catch {
        // The player may already be gone during a route transition.
      }
    }
    ytPlayerRef.current = null
    ytPlayerKeyRef.current = null
    setYtPlayer(null)
    setYtPlayerKey(null)
    youtubeMountRef.current = null
    if (mount?.parentElement === youtubeContainerRef.current) {
      mount.remove()
    }
  }, [youtubeContainerRef])

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
    audioRef.current?.pause()
    const player = ytPlayerRef.current
    if (player && typeof player.pauseVideo === "function") {
      try {
        player.pauseVideo()
      } catch (error) {
        console.warn("Could not pause YouTube player:", error)
      }
    }
  }, [])

  const resetPlayback = useCallback(() => {
    playSessionIdRef.current++
    clearPlaybackTimers()
    setIsPlaying(false)
    setIsPaused(false)
    setProgress(0)
  }, [clearPlaybackTimers])

  const startProgressTimer = useCallback(
    (duration: number, initialElapsed = 0) => {
      clearPlaybackTimers()
      const capturedSessionId = playSessionIdRef.current
      const startTime = Date.now() - initialElapsed

      progressIntervalRef.current = setInterval(() => {
        if (capturedSessionId !== playSessionIdRef.current) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
          return
        }
        const elapsed = Date.now() - startTime
        setProgress(Math.min((elapsed / duration) * 100, 100))
      }, 50)

      timeoutRef.current = setTimeout(async () => {
        if (capturedSessionId !== playSessionIdRef.current) return
        await pauseCurrentPlayback()
        setIsPlaying(false)
        setIsPaused(false)
        clearPlaybackTimers()
        setProgress(100)
      }, Math.max(duration - initialElapsed, 0))
    },
    [clearPlaybackTimers, pauseCurrentPlayback]
  )

  useEffect(() => {
    if (!needsYoutube) return

    if (window.YT?.Player) {
      setYtReady(true)
      return
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[src='https://www.youtube.com/iframe_api']")
    if (!existingScript) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      tag.onerror = () => {
        youtubePlaybackFailedRef.current = true
        setPlaybackError("Could not load the YouTube player.")
        setRetryAvailable(youtubeRetryCountRef.current === 0)
        setLoadingStep(null)
      }
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
    }

    const previousReady = window.onYouTubeIframeAPIReady
    const readyCallback = () => {
      previousReady?.()
      setYtReady(true)
    }
    window.onYouTubeIframeAPIReady = readyCallback

    return () => {
      if (window.onYouTubeIframeAPIReady === readyCallback) {
        window.onYouTubeIframeAPIReady = previousReady
      }
    }
  }, [needsYoutube, youtubeScriptAttempt])

  useEffect(() => {
    if (!needsYoutube || ytReady) return

    const timeout = setTimeout(() => {
      if (!window.YT?.Player) {
        youtubePlaybackFailedRef.current = true
        setPlaybackError("Could not load the YouTube player in time. Try again.")
        setRetryAvailable(youtubeRetryCountRef.current === 0)
        setLoadingStep(null)
      }
    }, 10000)

    return () => clearTimeout(timeout)
  }, [needsYoutube, ytReady])

  const resolveYouTubeFallback = useCallback(
    async (track: GameTrack, cacheKey: string, excludeVideoIds: readonly string[] = []) => {
    youtubeResolveControllerRef.current?.abort()
    const controller = new AbortController()
    const expectedTrackKey = getTrackPlaybackKey(track)
    let timedOut = false
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, AUDIO_LOAD_TIMEOUT_MS)
    youtubeResolveControllerRef.current = controller
    youtubePlaybackFailedRef.current = false
    setPlaybackError(null)
    setIsResolvingAudio(true)
    setLoadingStep("Searching YouTube for audio source...")

    const params = new URLSearchParams({ title: track.name, artists: track.artists })
    for (const videoId of excludeVideoIds) params.append("excludeVideoId", videoId)

    try {
      const response = await fetch(`/api/youtube/search?${params.toString()}`, {
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Could not find a YouTube fallback for this track.")
      }
      const resolvedSource = parseResolvedAudioSource(data, track)
      if (!resolvedSource) {
        throw new Error("No playable audio source was found for this track.")
      }

      if (excludeVideoIds.includes(resolvedSource.videoId)) {
        throw new Error("YouTube returned a source that already failed for this track.")
      }

      if (controller.signal.aborted || trackPlaybackKeyRef.current !== expectedTrackKey) return false
      if (track.dailyEligible !== true || resolvedSource.audioStartVerified) {
        try {
          localStorage.setItem(cacheKey, serializeResolvedAudioSource(resolvedSource))
        } catch (error) {
          console.warn("Could not save to localStorage cache:", error)
        }
      }
      updateActiveYoutubeSource(resolvedSource)
      setPlaybackError(null)
      setRetryAvailable(false)
      setLoadingStep("Loading YouTube player...")
      youtubeVideoIdRef.current = resolvedSource.videoId
      setYoutubeVideoId(resolvedSource.videoId)
      return true
    } catch (error) {
      if (trackPlaybackKeyRef.current !== expectedTrackKey) return false
      if (controller.signal.aborted && !timedOut) return false
      console.error("YouTube search failed:", error)
      youtubePlaybackFailedRef.current = true
      setPlaybackError(
        timedOut
          ? "Audio source lookup timed out. Try again."
          : "No playable audio source was found for this track."
      )
      setRetryAvailable(youtubeRetryCountRef.current === 0)
      setLoadingStep(null)
      return false
    } finally {
      clearTimeout(timeoutId)
      if (youtubeResolveControllerRef.current === controller) {
        youtubeResolveControllerRef.current = null
        setIsResolvingAudio(false)
      }
    }
  }, [updateActiveYoutubeSource])

  useEffect(() => {
    playbackGenerationRef.current += 1
    trackPlaybackKeyRef.current = trackPlaybackKey
    youtubeResolveControllerRef.current?.abort()
    destroyYoutubePlayer()
    youtubeRetryCountRef.current = 0
    failedVideoIdsRef.current = new Set()
    youtubePlaybackFailedRef.current = false
    setYoutubeVideoId(null)
    setYtPlayerKey(null)
    setPlaybackError(null)
    setRetryAvailable(false)
    setIsRetryingAudio(false)
    setIsResolvingAudio(false)
    setLoadingStep(null)
    setUseYoutubeFallback(false)
    updateActiveYoutubeSource(null)
    resetPlayback()
    youtubeVideoIdRef.current = null

    if (!currentTrack) return
    if (isYoutubeTrack(currentTrack)) {
      setLoadingStep("Loading YouTube player...")
      const nextVideoId = currentTrack.videoId || currentTrack.uri.replace(/^youtube:/, "")
      updateActiveYoutubeSource(createResolvedAudioSource(currentTrack, nextVideoId))
      youtubeVideoIdRef.current = nextVideoId
      setYoutubeVideoId(nextVideoId)
      return
    }
    if (currentTrack.preview_url) return

    const cacheKey = getYouTubeAudioCacheKey(currentTrack.uri)
    const cachedRaw = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null
    const cachedSource = cachedRaw ? parseResolvedAudioSource(cachedRaw, currentTrack) : null

    if (cachedSource) {
      setLoadingStep("Loading YouTube player...")
      updateActiveYoutubeSource(cachedSource)
      youtubeVideoIdRef.current = cachedSource.videoId
      setYoutubeVideoId(cachedSource.videoId)
      return
    }
    if (cachedRaw) {
      try {
        localStorage.removeItem(cacheKey)
      } catch {
        // Cache invalidation is best effort.
      }
    }

    void resolveYouTubeFallback(currentTrack, cacheKey)

    return () => {
      youtubeResolveControllerRef.current?.abort()
      destroyYoutubePlayer()
    }
  }, [
    currentTrack,
    destroyYoutubePlayer,
    resetPlayback,
    resolveYouTubeFallback,
    trackPlaybackKey,
    updateActiveYoutubeSource,
  ])

  useEffect(() => {
    return () => {
      youtubeResolveControllerRef.current?.abort()
      destroyYoutubePlayer()
    }
  }, [destroyYoutubePlayer])

  useEffect(() => {
    if (
      ytPlayerRef.current &&
      (ytPlayerKeyRef.current !== trackPlaybackKey || youtubeVideoIdRef.current !== youtubeVideoId)
    ) {
      destroyYoutubePlayer()
    }
    if (!ytReady || !youtubeVideoId || ytPlayerRef.current) return

    const expectedTrackKey = trackPlaybackKey
    const expectedVideoId = youtubeVideoId
    const expectedGeneration = playbackGenerationRef.current
    let isMounted = true
    let playerReady = false
    let containerRetryTimeout: ReturnType<typeof setTimeout> | null = null
    let playerMount: HTMLDivElement | null = null

    const isCurrentGeneration = () =>
      isMounted &&
      playbackGenerationRef.current === expectedGeneration &&
      trackPlaybackKeyRef.current === expectedTrackKey &&
      youtubeVideoIdRef.current === expectedVideoId &&
      youtubeVideoId === expectedVideoId

    const isCurrentPlayer = () =>
      isCurrentGeneration() &&
      playerMount !== null &&
      youtubeMountRef.current === playerMount

    const markPlayerError = (message: string, requirePlayerMount = true) => {
      if (requirePlayerMount ? !isCurrentPlayer() : !isCurrentGeneration()) return
      youtubePlaybackFailedRef.current = true
      failedVideoIdsRef.current.add(expectedVideoId)
      if (currentTrack && !isYoutubeTrack(currentTrack)) {
        try {
          const cacheKey = getYouTubeAudioCacheKey(currentTrack.uri)
          const cachedSource = parseResolvedAudioSource(localStorage.getItem(cacheKey), currentTrack)
          if (cachedSource?.videoId === expectedVideoId) {
            localStorage.removeItem(cacheKey)
          }
        } catch {
          // Cache invalidation is best effort.
        }
      }
      playSessionIdRef.current++
      clearPlaybackTimers()
      setIsPlaying(false)
      setIsPaused(false)
      setLoadingStep(null)
      setPlaybackError(message)
      setRetryAvailable(youtubeRetryCountRef.current === 0)
    }

    const playerReadyTimeout = window.setTimeout(() => {
      if (!playerReady) {
        markPlayerError("Could not load this YouTube audio in time. Try again.", false)
      }
    }, AUDIO_LOAD_TIMEOUT_MS)

    const initPlayer = () => {
      if (!isCurrentGeneration()) return
      const host = youtubeContainerRef.current
      if (!host) {
        containerRetryTimeout = setTimeout(initPlayer, 100)
        return
      }

      playerMount = document.createElement("div")
      playerMount.dataset.youtubePlayerMount = expectedTrackKey ?? "unknown"
      host.appendChild(playerMount)
      youtubeMountRef.current = playerMount

      try {
        const player = new window.YT.Player(playerMount, {
          height: "1",
          width: "1",
          videoId: expectedVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!isCurrentPlayer()) return
              playerReady = true
              clearTimeout(playerReadyTimeout)
              try {
                event.target.unMute()
                event.target.setVolume(100)
              } catch {
                // YouTube may reject volume control in some browsers.
              }
              ytPlayerRef.current = event.target
              ytPlayerKeyRef.current = expectedTrackKey
              setYtPlayer(event.target)
              setYtPlayerKey(expectedTrackKey)
              setLoadingStep(null)
            },
            onError: () => {
              markPlayerError("This YouTube audio source could not be played.")
            },
            onStateChange: (event: any) => {
              if (!isCurrentPlayer() || youtubePlaybackFailedRef.current) return
              if (event.data === 1) {
                setIsPlaying(true)
                setIsPaused(false)
              } else if (event.data === 2) {
                setIsPlaying(false)
                setIsPaused(true)
              } else if (event.data === 0) {
                setIsPlaying(false)
                setIsPaused(false)
                setProgress(100)
                clearPlaybackTimers()
              }
            },
          },
        })

        if (player && !ytPlayerRef.current && isCurrentPlayer()) {
          ytPlayerRef.current = player
          ytPlayerKeyRef.current = expectedTrackKey
        }
      } catch {
        if (playerMount?.parentElement === host) playerMount.remove()
        if (youtubeMountRef.current === playerMount) youtubeMountRef.current = null
        markPlayerError("Could not create the YouTube player. Try again.")
      }
    }

    initPlayer()

    return () => {
      isMounted = false
      clearTimeout(playerReadyTimeout)
      if (containerRetryTimeout) clearTimeout(containerRetryTimeout)
      if (playerMount && youtubeMountRef.current === playerMount && !ytPlayerRef.current) {
        playerMount.remove()
        youtubeMountRef.current = null
      }
    }
  }, [
    clearPlaybackTimers,
    currentTrack,
    destroyYoutubePlayer,
    trackPlaybackKey,
    youtubeContainerRef,
    ytReady,
    youtubeVideoId,
  ])

  useEffect(() => {
    if (ytPlayer && youtubeVideoId && ytPlayerKey === trackPlaybackKey) {
      try {
        ytPlayer.cueVideoById(youtubeVideoId)
        setLoadingStep(null)
      } catch (error) {
        console.warn("Could not cue YouTube video:", error)
      }
    } else if (ytPlayer && !youtubeVideoId) {
      try {
        ytPlayer.stopVideo()
      } catch {
        // Player can be missing during route transitions.
      }
    }
  }, [trackPlaybackKey, youtubeVideoId, ytPlayer, ytPlayerKey])

  const playSegment = async (positionMs = 0) => {
    if (!currentTrack) return false
    if (playbackError) return false
    const currentPlaySessionId = ++playSessionIdRef.current
    const duration = stageDurations[currentStage]
    // A fallback source owns its own offset. Never reuse the previous video's
    // analysis metadata after a retry. Custom playlist sources without an
    // approved manifest intentionally start at zero; Daily sources fail closed
    // below instead of pretending an unverified offset is safe.
    const audioStartSeconds = activeYoutubeSource?.audioStartSeconds ?? 0
    clearPlaybackTimers()

    if (currentTrack.preview_url && !useYoutubeFallback && audioRef.current) {
      if (audioRef.current.src !== currentTrack.preview_url) {
        audioRef.current.src = currentTrack.preview_url
      }
      try {
        audioRef.current.currentTime = positionMs / 1000
        await audioRef.current.play()
      } catch (error) {
        console.warn("Could not play audio preview:", error)
        if (currentPlaySessionId === playSessionIdRef.current) {
          setIsPlaying(false)
          setIsPaused(false)
          setProgress(0)
          setPlaybackError("This audio preview could not be played.")
          setUseYoutubeFallback(true)
          setRetryAvailable(youtubeRetryCountRef.current === 0)
        }
        return false
      }

      if (currentPlaySessionId !== playSessionIdRef.current) return false
      setIsPlaying(true)
      setIsPaused(false)
      setProgress((positionMs / duration) * 100)
      startProgressTimer(duration, positionMs)
      return true
    }

    const player = ytPlayerRef.current
    if (
      youtubeVideoId &&
      player &&
      typeof player.playVideo === "function" &&
      !youtubePlaybackFailedRef.current
    ) {
      if (
        currentTrack.dailyEligible === true &&
        activeYoutubeSource !== null &&
        !activeYoutubeSource.audioStartVerified
      ) {
        setPlaybackError("This fallback audio source has not been start-verified.")
        setRetryAvailable(false)
        return false
      }
      try {
        const targetSeconds = audioStartSeconds + positionMs / 1000
        player.unMute?.()
        player.setVolume?.(100)
        player.pauseVideo?.()
        player.seekTo(targetSeconds, true)
        await wait(80)
        if (currentPlaySessionId !== playSessionIdRef.current || youtubePlaybackFailedRef.current) return false
        player.playVideo()
        await wait(120)
        if (
          currentPlaySessionId === playSessionIdRef.current &&
          !youtubePlaybackFailedRef.current
        ) {
          player.unMute?.()
          player.setVolume?.(100)
          player.playVideo()
        }
        if (
          currentPlaySessionId !== playSessionIdRef.current ||
          youtubePlaybackFailedRef.current
        ) {
          return false
        }
        setIsPlaying(true)
        setIsPaused(false)
        setProgress((positionMs / duration) * 100)
        startProgressTimer(duration, positionMs)
        return true
      } catch (error) {
        console.warn("Could not play YouTube video:", error)
        youtubePlaybackFailedRef.current = true
        setPlaybackError("This YouTube audio source could not be played.")
        if (youtubeVideoId) failedVideoIdsRef.current.add(youtubeVideoId)
        setRetryAvailable(youtubeRetryCountRef.current === 0)
      }
    }

    return false
  }

  const retryAudioSource = useCallback(async () => {
    if (
      !currentTrack ||
      !retryAvailable ||
      isRetryingAudio ||
      youtubeRetryCountRef.current > 0
    ) {
      return false
    }

    youtubeRetryCountRef.current += 1
    setIsRetryingAudio(true)
    setUseYoutubeFallback(true)
    setRetryAvailable(false)
    setPlaybackError(null)
    setLoadingStep("Searching for a verified fallback...")
    const failedVideoId =
      activeYoutubeSourceRef.current?.videoId || youtubeVideoIdRef.current || null
    destroyYoutubePlayer()
    updateActiveYoutubeSource(null)
    youtubeVideoIdRef.current = null
    setYoutubeVideoId(null)

    // A failed iframe script is not recoverable by selecting another video.
    // Remove it and let the retry start a fresh script request once.
    if (youtubePlaybackFailedRef.current && !window.YT?.Player) {
      document
        .querySelector<HTMLScriptElement>("script[src='https://www.youtube.com/iframe_api']")
        ?.remove()
      setYtReady(false)
      setYoutubeScriptAttempt((attempt) => attempt + 1)
    }

    const cacheKey = getYouTubeAudioCacheKey(currentTrack.uri)
    try {
      localStorage.removeItem(cacheKey)
    } catch {
      // Cache invalidation is best effort.
    }

    const currentVideoId =
      failedVideoId ||
      (isYoutubeTrack(currentTrack)
        ? currentTrack.videoId || currentTrack.uri.replace(/^youtube:/, "")
        : null)
    if (currentVideoId && /^[a-zA-Z0-9_-]{6,32}$/.test(currentVideoId)) {
      failedVideoIdsRef.current.add(currentVideoId)
    }

    const success = await resolveYouTubeFallback(
      currentTrack,
      cacheKey,
      [...failedVideoIdsRef.current]
    )
    setIsRetryingAudio(false)
    if (!success) setRetryAvailable(false)
    return success
  }, [
    currentTrack,
    destroyYoutubePlayer,
    isRetryingAudio,
    resolveYouTubeFallback,
    retryAvailable,
    updateActiveYoutubeSource,
  ])

  const pause = async () => {
    if (!isPlaying) return
    playSessionIdRef.current++
    setIsPlaying(false)
    setIsPaused(true)
    clearPlaybackTimers()
    await pauseCurrentPlayback()
  }

  const resume = async () => {
    if (isPlaying) return
    const duration = stageDurations[currentStage]
    const elapsed = Math.round((progress / 100) * duration)
    await playSegment(elapsed)
  }

  return {
    progress,
    isPlaying,
    isPaused,
    isResolvingAudio,
    isRetryingAudio,
    isPlayerReady,
    loadingStep,
    playbackError,
    canRetryAudio: retryAvailable && !isResolvingAudio && !isRetryingAudio,
    playSegment,
    pause,
    resume,
    pauseCurrentPlayback,
    resetPlayback,
    retryAudioSource,
  }
}
