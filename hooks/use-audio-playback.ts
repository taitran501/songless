"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { GameTrack } from "@/lib/tracks"
import { isYoutubeTrack } from "@/lib/tracks"

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

  const audioRef = useRef<HTMLAudioElement | null>(null)
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
    if (ytPlayer && typeof ytPlayer.pauseVideo === "function") {
      try {
        ytPlayer.pauseVideo()
      } catch (error) {
        console.warn("Could not pause YouTube player:", error)
      }
    }
  }, [ytPlayer])

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
      tag.onerror = () => setPlaybackError("Could not load the YouTube player.")
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
    }

    window.onYouTubeIframeAPIReady = () => setYtReady(true)
  }, [needsYoutube])

  useEffect(() => {
    if (!needsYoutube || ytReady) return

    const timeout = setTimeout(() => {
      if (!window.YT?.Player) {
        setPlaybackError("Could not load the YouTube player.")
      }
    }, 10000)

    return () => clearTimeout(timeout)
  }, [needsYoutube, ytReady])

  useEffect(() => {
    setYoutubeVideoId(null)
    setPlaybackError(null)
    setIsResolvingAudio(false)
    resetPlayback()

    if (!currentTrack) return
    if (isYoutubeTrack(currentTrack)) {
      setYoutubeVideoId(currentTrack.videoId || currentTrack.uri.replace(/^youtube:/, ""))
      return
    }
    if (currentTrack.preview_url) return

    let isMounted = true
    const query = `${currentTrack.artists} - ${currentTrack.name}`
    setIsResolvingAudio(true)
    fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Could not find a YouTube fallback for this track.")
        }
        return data
      })
      .then((data) => {
        if (isMounted && data.videoId) setYoutubeVideoId(data.videoId)
        if (isMounted && !data.videoId) {
          setPlaybackError("No playable audio source was found for this track.")
        }
      })
      .catch((error) => {
        console.error("YouTube search failed:", error)
        if (isMounted) setPlaybackError("No playable audio source was found for this track.")
      })
      .finally(() => {
        if (isMounted) setIsResolvingAudio(false)
      })

    return () => {
      isMounted = false
    }
  }, [currentTrack, resetPlayback])

  useEffect(() => {
    if (!ytReady) return

    if (youtubeVideoId && !ytPlayer) {
      new window.YT.Player("youtube-player", {
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
            try {
              event.target.unMute()
              event.target.setVolume(100)
            } catch {
              // YouTube may reject volume control in some browsers.
            }
            setYtPlayer(event.target)
          },
        },
      })
    }

    if (ytPlayer && youtubeVideoId) {
      try {
        ytPlayer.cueVideoById(youtubeVideoId)
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
  }, [ytReady, youtubeVideoId, ytPlayer])

  const playSegment = async (positionMs = 0) => {
    if (!currentTrack) return false
    if (playbackError) return false
    const currentPlaySessionId = ++playSessionIdRef.current
    const duration = stageDurations[currentStage]
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

    if (youtubeVideoId && ytPlayer && typeof ytPlayer.playVideo === "function") {
      try {
        ytPlayer.unMute?.()
        ytPlayer.setVolume?.(100)
        ytPlayer.seekTo(positionMs / 1000)
        ytPlayer.playVideo()
        setIsPlaying(true)
        setIsPaused(false)
        setProgress((positionMs / duration) * 100)
        startProgressTimer(duration, positionMs)
        return true
      } catch (error) {
        console.warn("Could not play YouTube video:", error)
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
    playbackError,
    playSegment,
    pause,
    resume,
    pauseCurrentPlayback,
    resetPlayback,
  }
}
