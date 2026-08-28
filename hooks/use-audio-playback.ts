"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GameTrack } from "@/lib/tracks"
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
}

const AUDIO_LOAD_TIMEOUT_MS = 10_000

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
    document.getElementById("youtube-player")?.replaceChildren()
  }, [])

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
      if (typeof data.videoId !== "string" || !/^[a-zA-Z0-9_-]{6,32}$/.test(data.videoId)) {
        throw new Error("No playable audio source was found for this track.")
      }

      if (excludeVideoIds.includes(data.videoId)) {
        throw new Error("YouTube returned a source that already failed for this track.")
      }

      if (controller.signal.aborted || trackPlaybackKeyRef.current !== expectedTrackKey) return false
      try {
        localStorage.setItem(cacheKey, data.videoId)
      } catch (error) {
        console.warn("Could not save to localStorage cache:", error)
      }
      setPlaybackError(null)
      setRetryAvailable(false)
      setLoadingStep("Loading YouTube player...")
      youtubeVideoIdRef.current = data.videoId
      setYoutubeVideoId(data.videoId)
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
  }, [])

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
    resetPlayback()
    youtubeVideoIdRef.current = null

    if (!currentTrack) return
    if (isYoutubeTrack(currentTrack)) {
      setLoadingStep("Loading YouTube player...")
      const nextVideoId = currentTrack.videoId || currentTrack.uri.replace(/^youtube:/, "")
      youtubeVideoIdRef.current = nextVideoId
      setYoutubeVideoId(nextVideoId)
      return
    }
    if (currentTrack.preview_url) return

    const cacheKey = getYouTubeAudioCacheKey(currentTrack.uri)
    const cachedId = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null

    if (cachedId && /^[a-zA-Z0-9_-]{6,32}$/.test(cachedId)) {
      setLoadingStep("Loading YouTube player...")
      youtubeVideoIdRef.current = cachedId
      setYoutubeVideoId(cachedId)
      return
    }
    if (cachedId) {
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

    const isCurrentPlayer = () =>
      isMounted &&
      playbackGenerationRef.current === expectedGeneration &&
      trackPlaybackKeyRef.current === expectedTrackKey &&
      youtubeVideoIdRef.current === expectedVideoId &&
      youtubeVideoId === expectedVideoId

    const markPlayerError = (message: string) => {
      if (!isCurrentPlayer()) return
      youtubePlaybackFailedRef.current = true
      failedVideoIdsRef.current.add(expectedVideoId)
      if (currentTrack && !isYoutubeTrack(currentTrack)) {
        try {
          const cacheKey = getYouTubeAudioCacheKey(currentTrack.uri)
          if (localStorage.getItem(cacheKey) === expectedVideoId) {
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
        markPlayerError("Could not load this YouTube audio in time. Try again.")
      }
    }, AUDIO_LOAD_TIMEOUT_MS)

    const initPlayer = () => {
      if (!isCurrentPlayer()) return
      const container = document.getElementById("youtube-player")
      if (!container) {
        containerRetryTimeout = setTimeout(initPlayer, 100)
        return
      }

      try {
        const player = new window.YT.Player("youtube-player", {
          height: "200",
          width: "200",
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
              if (!isCurrentPlayer()) {
                event.target?.destroy?.()
                return
              }
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
        markPlayerError("Could not create the YouTube player. Try again.")
      }
    }

    initPlayer()

    return () => {
      isMounted = false
      clearTimeout(playerReadyTimeout)
      if (containerRetryTimeout) clearTimeout(containerRetryTimeout)
    }
  }, [clearPlaybackTimers, currentTrack, destroyYoutubePlayer, trackPlaybackKey, ytReady, youtubeVideoId])

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
    // Custom playlist tracks may not have an analysis manifest, so playback
    // starts at zero for them. Daily tracks are validated server-side and
    // always carry a reviewed audioStartSeconds value before reaching here.
    const audioStartSeconds =
      typeof currentTrack.audioStartSeconds === "number" &&
      Number.isFinite(currentTrack.audioStartSeconds) &&
      currentTrack.audioStartSeconds >= 0
        ? currentTrack.audioStartSeconds
        : 0
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
    destroyYoutubePlayer()
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

    const currentVideoId = isYoutubeTrack(currentTrack)
      ? currentTrack.videoId || currentTrack.uri.replace(/^youtube:/, "")
      : youtubeVideoId
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
  }, [currentTrack, destroyYoutubePlayer, isRetryingAudio, resolveYouTubeFallback, retryAvailable, youtubeVideoId])

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
