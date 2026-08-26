"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GameTrack } from "@/lib/tracks"
import { isYoutubeTrack } from "@/lib/tracks"
import {
  getYouTubeAudioCacheKey,
  shouldRetryCachedYouTubeSource,
  type YouTubeAudioSourceKind,
} from "@/lib/youtube"

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void
    YT: any
  }
}

interface UseAudioPlaybackOptions {
  currentTrack?: GameTrack
  currentStage: number
  stageDurations: readonly number[]
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
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
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [isResolvingAudio, setIsResolvingAudio] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ytPlayerRef = useRef<any>(null)
  const youtubeResolveControllerRef = useRef<AbortController | null>(null)
  const youtubeSourceKindRef = useRef<YouTubeAudioSourceKind>("resolved")
  const youtubeRetryCountRef = useRef(0)
  const youtubePlaybackFailedRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const playSessionIdRef = useRef(0)

  const needsYoutube = !!currentTrack && !currentTrack.preview_url
  const isPlayerReady = !playbackError && (!needsYoutube || (youtubeVideoId !== null && ytPlayer !== null))

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
    setYtPlayer(null)
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
      }
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
    }

    window.onYouTubeIframeAPIReady = () => setYtReady(true)
  }, [needsYoutube])

  useEffect(() => {
    if (!needsYoutube || ytReady) return

    const timeout = setTimeout(() => {
      if (!window.YT?.Player) {
        youtubePlaybackFailedRef.current = true
        setPlaybackError("Could not load the YouTube player.")
      }
    }, 10000)

    return () => clearTimeout(timeout)
  }, [needsYoutube, ytReady])

  const resolveYouTubeFallback = useCallback((track: GameTrack, cacheKey: string) => {
    youtubeResolveControllerRef.current?.abort()
    const controller = new AbortController()
    youtubeResolveControllerRef.current = controller
    youtubePlaybackFailedRef.current = false
    setPlaybackError(null)
    setIsResolvingAudio(true)
    setLoadingStep("Searching YouTube for audio source...")

    void fetch(
      `/api/youtube/search?title=${encodeURIComponent(track.name)}&artists=${encodeURIComponent(track.artists)}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Could not find a YouTube fallback for this track.")
        }
        return data
      })
      .then((data) => {
        if (controller.signal.aborted) return
        if (!data.videoId) {
          throw new Error("No playable audio source was found for this track.")
        }
        try {
          localStorage.setItem(cacheKey, data.videoId)
        } catch (error) {
          console.warn("Could not save to localStorage cache:", error)
        }
        youtubeSourceKindRef.current = "resolved"
        setLoadingStep("Loading YouTube player...")
        setYoutubeVideoId(data.videoId)
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        console.error("YouTube search failed:", error)
        youtubePlaybackFailedRef.current = true
        setPlaybackError("No playable audio source was found for this track.")
        setLoadingStep(null)
      })
      .finally(() => {
        if (youtubeResolveControllerRef.current === controller) {
          youtubeResolveControllerRef.current = null
          setIsResolvingAudio(false)
        }
      })
  }, [])

  useEffect(() => {
    youtubeResolveControllerRef.current?.abort()
    destroyYoutubePlayer()
    youtubeRetryCountRef.current = 0
    youtubeSourceKindRef.current = "resolved"
    youtubePlaybackFailedRef.current = false
    setYoutubeVideoId(null)
    setPlaybackError(null)
    setIsResolvingAudio(false)
    setLoadingStep(null)
    resetPlayback()

    if (!currentTrack) return
    if (isYoutubeTrack(currentTrack)) {
      youtubeSourceKindRef.current = "direct"
      setYoutubeVideoId(currentTrack.videoId || currentTrack.uri.replace(/^youtube:/, ""))
      return
    }
    if (currentTrack.preview_url) return

    const cacheKey = getYouTubeAudioCacheKey(currentTrack.uri)
    const cachedId = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null

    if (cachedId) {
      youtubeSourceKindRef.current = "cached"
      setLoadingStep("Loading YouTube player...")
      setYoutubeVideoId(cachedId)
      return
    }

    resolveYouTubeFallback(currentTrack, cacheKey)

    return () => {
      youtubeResolveControllerRef.current?.abort()
      destroyYoutubePlayer()
    }
  }, [currentTrack, destroyYoutubePlayer, resetPlayback, resolveYouTubeFallback])

  useEffect(() => {
    return () => {
      youtubeResolveControllerRef.current?.abort()
      destroyYoutubePlayer()
    }
  }, [destroyYoutubePlayer])

  useEffect(() => {
    if (!ytReady || !youtubeVideoId || ytPlayerRef.current) return

    let isMounted = true

    const initPlayer = () => {
      if (!isMounted) return
      const container = document.getElementById("youtube-player")
      if (!container) {
        // Retry in 100ms if container is not mounted yet
        setTimeout(initPlayer, 100)
        return
      }

      const handleYoutubeError = () => {
        if (!isMounted) return
        youtubePlaybackFailedRef.current = true
        playSessionIdRef.current++
        clearPlaybackTimers()
        setIsPlaying(false)
        setIsPaused(false)

        const canRetryCachedSource =
          currentTrack &&
          !isYoutubeTrack(currentTrack) &&
          !currentTrack.preview_url &&
          shouldRetryCachedYouTubeSource(
            youtubeSourceKindRef.current,
            youtubeRetryCountRef.current
          )

        if (canRetryCachedSource && currentTrack) {
          youtubeRetryCountRef.current += 1
          const cacheKey = getYouTubeAudioCacheKey(currentTrack.uri)
          localStorage.removeItem(cacheKey)
          destroyYoutubePlayer()
          setYoutubeVideoId(null)
          resolveYouTubeFallback(currentTrack, cacheKey)
          return
        }

        setLoadingStep(null)
        setPlaybackError("This YouTube audio source could not be played.")
      }

      const player = new window.YT.Player("youtube-player", {
        height: "200",
        width: "200",
        videoId: youtubeVideoId,
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
            if (!isMounted) return
            try {
              event.target.unMute()
              event.target.setVolume(100)
            } catch {
              // YouTube may reject volume control in some browsers.
            }
            ytPlayerRef.current = event.target
            setYtPlayer(event.target)
            setLoadingStep(null)
          },
          onError: handleYoutubeError,
          onStateChange: (event: any) => {
            if (!isMounted || youtubePlaybackFailedRef.current) return
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

      if (player && !ytPlayerRef.current) ytPlayerRef.current = player
    }

    initPlayer()

    return () => {
      isMounted = false
    }
  }, [clearPlaybackTimers, currentTrack, destroyYoutubePlayer, resolveYouTubeFallback, ytReady, youtubeVideoId])

  useEffect(() => {
    if (ytPlayer && youtubeVideoId) {
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
  }, [youtubeVideoId, ytPlayer])

  const playSegment = async (positionMs = 0) => {
    if (!currentTrack) return false
    if (playbackError) return false
    const currentPlaySessionId = ++playSessionIdRef.current
    const duration = stageDurations[currentStage]
    const audioStartSeconds = currentTrack.audioStartSeconds || 0
    clearPlaybackTimers()

    if (currentTrack.preview_url && audioRef.current) {
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
      }
    }

    return false
  }

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
    isPlayerReady,
    loadingStep,
    playbackError,
    playSegment,
    pause,
    resume,
    pauseCurrentPlayback,
    resetPlayback,
  }
}
